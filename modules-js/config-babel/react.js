module.exports = function react(_, { esm }) {
  return {
    plugins: [
      [
        require('@babel/plugin-transform-runtime'),
        {
          helpers: false,
          polyfill: false,
          regenerator: true,
        },
      ],
    ],
    presets: [
      [require('@babel/preset-env'), { modules: esm ? false : undefined }],
      require('@babel/preset-react'),
    ],
  };
};
