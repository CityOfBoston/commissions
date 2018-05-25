/* eslint no-console: 0 */

import path from 'path';

import AWS from 'aws-sdk';
import shell, { ExecOutputReturnValue } from 'shelljs';
import tar from 'tar';

export const AWS_REGION = 'us-east-1';
AWS.config.update({ region: AWS_REGION });

export const STAGING_CLUSTER = 'AppsStaging';
export const PROD_CLUSTER = 'AppsProd';

export const BANNER = `
┌───────────────────────────┐
│ 🎀 Yo it’s Shippy-Toe! 🎀 │
└───────────────────────────┘
`;

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export async function getAccountId(): Promise<string> {
  const sts = new AWS.STS();
  return (await sts.getCallerIdentity().promise()).Account!;
}

export async function dockerAwsLogin() {
  const ecr = new AWS.ECR();
  const response = await ecr.getAuthorizationToken().promise();

  if (response.authorizationData) {
    response.authorizationData.forEach(
      ({ authorizationToken, proxyEndpoint }) => {
        const [username, password] = new Buffer(authorizationToken!, 'base64')
          .toString()
          .split(':');

        const command = `docker login -u ${username} -p ${password} ${proxyEndpoint}`;

        if (
          (shell.exec(command, { silent: true }) as ExecOutputReturnValue)
            .code !== 0
        ) {
          throw new Error(`Unable to run docker login for ${proxyEndpoint}`);
        }
      }
    );
  }
}

/**
 * Makes a tar of just the package.json files in the repo. This will let us do a
 * yarn install based on those, which will then be mostly cached across builds
 * (since package.jsons don’t change very often).
 *
 * Doing this with a tar is because Docker doesn’t have a native way to COPY in
 * a filtered subtree of files. (Glob patterns cause all the files end up in the
 * destination directory, not their subdirectories.)
 */
export async function makePackageJsonTar(workspaceDir) {
  const packages = (shell.exec(
    `find ../.. -name 'package.json' -not -path "*/node_modules/*"`,
    {
      silent: true,
    }
  ).stdout as string).split('\n');
  packages.pop();

  await tar.create(
    {
      file: path.join(workspaceDir, 'package-json.tar'),
      cwd: workspaceDir,
      portable: true,
    },
    packages.map(p => p.replace('../../', ''))
  );
}

/**
 * @param image Repository or image name
 * @returns True if successful
 */
export async function pullImage(image: string, tag: string): Promise<boolean> {
  const command = `docker pull ${image}:${tag}`;

  return shell.exec(command).code === 0;
}

export async function buildImage(
  dir,
  dockerfilePath: string,
  cacheFromImage: string | null,
  tags: string[] = []
) {
  const command = `docker build \
    --pull \
    -f ${dockerfilePath} \
    ${cacheFromImage ? `--cache-from ${cacheFromImage}` : ''} \
    ${tags.map(t => `-t ${t}`).join(' ')} \
    ${dir}`;

  if (shell.exec(command).code !== 0) {
    throw new Error('Error building container');
  }
}

export async function pushImage(image: string) {
  if (shell.exec(`docker push ${image}`).code !== 0) {
    throw new Error('Error pushing container');
  }
}

export async function getRepository(
  environment: string,
  serviceName: string
): Promise<string> {
  const registry =
    environment === 'production'
      ? 'cob-digital-apps-prod'
      : 'cob-digital-apps-staging';
  const accountId = await getAccountId();
  return `${accountId}.dkr.ecr.${AWS_REGION}.amazonaws.com/${registry}/${serviceName}`;
}

export async function updateStagingService(serviceName: string) {
  const ecs = new AWS.ECS();

  const updatedService = (await ecs
    .updateService({
      cluster: STAGING_CLUSTER,
      service: serviceName,
      forceNewDeployment: true,
    })
    .promise()).service!;

  const latestDeployment = (updatedService.deployments || [])[0];
  if (!latestDeployment) {
    throw new Error('Could not find a new deployment');
  }

  return {
    service: updatedService,
    deploymentId: latestDeployment.id!,
  };
}

export async function updateProdService(serviceName: string, image: string) {
  const ecs = new AWS.ECS();

  const latestTaskDefinition = (await ecs
    .describeTaskDefinition({
      taskDefinition: `${PROD_CLUSTER}-${serviceName}`,
    })
    .promise()).taskDefinition!;

  const containerDefinitions: AWS.ECS.ContainerDefinition[] = (
    latestTaskDefinition.containerDefinitions || []
  ).map(c => ({
    ...c,
    image: c.image!.startsWith(image.split(':')[0]) ? image : c.image,
  }));

  const newTaskDefinition = (await ecs
    .registerTaskDefinition({
      family: latestTaskDefinition.family!,
      taskRoleArn: latestTaskDefinition.taskRoleArn,
      executionRoleArn: latestTaskDefinition.executionRoleArn,
      networkMode: latestTaskDefinition.networkMode,
      containerDefinitions,
      volumes: latestTaskDefinition.volumes,
      placementConstraints: latestTaskDefinition.placementConstraints,
      requiresCompatibilities: latestTaskDefinition.requiresCompatibilities,
      cpu: latestTaskDefinition.cpu,
      memory: latestTaskDefinition.memory,
    })
    .promise()).taskDefinition!;

  const { service, deploymentId } = await updateServiceTaskDefinition(
    'production',
    serviceName,
    newTaskDefinition.taskDefinitionArn!
  );

  // We try to find a deployment that’s running on the service, since the most
  // recent task definition might not actually be viable.
  const previousDeployment = (service.deployments || [])
    .filter(d => d.status === 'ACTIVE')
    .pop();

  const oldTaskDefinitionArn = previousDeployment
    ? previousDeployment.taskDefinition!
    : latestTaskDefinition.taskDefinitionArn!;

  return {
    service,
    deploymentId,
    newTaskDefinitionArn: newTaskDefinition.taskDefinitionArn!,
    oldTaskDefinitionArn,
  };
}

export async function updateServiceTaskDefinition(
  environment: string,
  serviceName: string,
  taskDefinitionArn: string
) {
  const ecs = new AWS.ECS();

  const updatedService = (await ecs
    .updateService({
      cluster: environment === 'production' ? PROD_CLUSTER : STAGING_CLUSTER,
      service: serviceName,
      taskDefinition: taskDefinitionArn,
    })
    .promise()).service!;

  const latestDeployment = (updatedService.deployments || [])[0];
  if (!latestDeployment) {
    throw new Error('Could not find a new deployment');
  }

  return { service: updatedService, deploymentId: latestDeployment.id! };
}

export async function deregisterTaskDefinition(taskDefinitionArn: string) {
  const ecs = new AWS.ECS();
  await ecs
    .deregisterTaskDefinition({
      taskDefinition: taskDefinitionArn,
    })
    .promise();
}

export async function waitForDeployment(
  service: AWS.ECS.Service,
  deploymentId: string,
  eventCb?: (e: AWS.ECS.ServiceEvent) => any
) {
  const ecs = new AWS.ECS();

  let deployed = false;
  let lastEventId = ((service.events || [])[0] || {}).id;
  let lastEventTimeMs = new Date().getTime();

  while (!deployed) {
    const updatedService = (await ecs
      .describeServices({
        cluster: service.clusterArn!,
        services: [service.serviceName!],
      })
      .promise()).services![0];

    const stoppedTaskArns =
      (await ecs
        .listTasks({
          cluster: service.clusterArn!,
          startedBy: deploymentId,
          desiredStatus: 'STOPPED',
        })
        .promise()).taskArns || [];

    if (stoppedTaskArns.length) {
      const stoppedTasks = (await ecs
        .describeTasks({
          cluster: service.clusterArn!,
          tasks: stoppedTaskArns,
        })
        .promise()).tasks!;

      const firstStoppedTask = stoppedTasks[0];
      throw new Error(
        `Deployment task ${firstStoppedTask.taskArn} failed: ${
          firstStoppedTask.stoppedReason
        }`
      );
    }

    const updatedDeployment = (updatedService.deployments || []).find(
      ({ id }) => id === deploymentId
    );

    if (!updatedDeployment) {
      throw new Error(
        `Could not find deployment ${deploymentId} in the service`
      );
    }

    const latestEvents: AWS.ECS.ServiceEvent[] = [];
    (updatedService.events || []).some(e => {
      if (e.id === lastEventId) {
        return true;
      } else {
        latestEvents.push(e);
        return false;
      }
    });

    if (latestEvents.length) {
      lastEventId = latestEvents[0].id;
      lastEventTimeMs = new Date().getTime();
    } else if (new Date().getTime() > lastEventTimeMs + 1000 * 60) {
      latestEvents.push({
        createdAt: new Date(),
        message: 'Still waiting…',
      });

      lastEventTimeMs = new Date().getTime();
    }

    latestEvents.reverse();

    if (eventCb) {
      latestEvents.forEach(eventCb);
    }

    if (updatedDeployment.status !== 'PRIMARY') {
      throw new Error(
        `Deployment failed with status ${updatedDeployment.status}`
      );
    } else if (
      (updatedService.deployments || []).filter(
        ({ status }) => status === 'ACTIVE'
      ).length === 0
    ) {
      deployed = true;
    } else {
      await sleep(3000);
    }
  }
}
