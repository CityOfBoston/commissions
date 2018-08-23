import React from 'react';
import { SectionHeader, PUBLIC_CSS_URL } from '@cityofboston/react-fleet';
import Head from 'next/head';

export default class ApplyPage extends React.Component {
  render() {
    return (
      <div className="mn">
        <Head>
          <link rel="stylesheet" href={PUBLIC_CSS_URL} />
        </Head>
        <SectionHeader title="Application Completion" />
        <div className="b b-c">
          <h1>THANK YOU FOR APPLYING!!!!</h1>
        </div>
      </div>
    );
  }
}
