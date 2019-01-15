const { readdirSync } = require('fs');
const { join, extname, basename } = require('path');
const assert = require('assert');

module.exports = function (api, options = {}) {
  const { log, paths } = api;

  log.warn(`
[umi-plugin-mpa] 使用 mpa 插件，意味着我们只使用 umi 作为构建工具。所以：

    1. 路由相关功能不工作
    2. global.css、global.js 无效
    3. app.js 无效
    4. 不支持 runtimePublicPath
  `.trim());
  console.log();

  // don't generate html files
  process.env.HTML = 'none';
  // don't add route middleware
  process.env.ROUTE_MIDDLEWARE = 'none';

  api.modifyWebpackConfig(webpackConfig => {
    if (options.entry) {
      assert(
        isPlainObject(options.entry),
        `options.entry should be object, but got ${JSON.stringify(options.entry)}`,
      );
    }

    // set entry
    const hmrScript = webpackConfig.entry['umi'][0];
    webpackConfig.entry = options.entry;
    if (!webpackConfig.entry) {
      // find entry from pages directory
      log.info(`[umi-plugin-mpa] options.entry is null, find files in pages for entry`);
      webpackConfig.entry = readdirSync(paths.absPagesPath)
        .filter(f => f.charAt(0) !== '.' && /\.(j|t)sx?$/.test(extname(f)))
        .reduce((memo, f) => {
          const name = basename(f, extname(f));
          memo[name] = [
            join(paths.absPagesPath, f),
          ];
          return memo;
        }, {});
    }

    // modify entry
    Object.keys(webpackConfig.entry).forEach(key => {
      const entry = webpackConfig.entry[key];
      webpackConfig.entry[key] = [
        // polyfill
        `${__dirname}/templates/polyfill.js`,
        // hmr
        ...(
          process.env.NODE_ENV === 'development' && hmrScript.includes('webpackHotDevClient.js')
            ? [hmrScript]
            : []
        ),
        // original entry
        ...(Array.isArray(entry) ? entry : [entry]),
      ];
    });

    return webpackConfig;
  });

  api.chainWebpackConfig(webpackConfig => {
    webpackConfig.module.rule('html')
      .test(/\.html?$/)
      .use('file-loader')
      .loader('file-loader')
      .options({
        name: options.htmlName || '[name].[ext]',
      });
  });

  api.modifyAFWebpackOpts(opts => {
    opts.urlLoaderExcludes = [
      ...(opts.urlLoaderExcludes || []),
      /\.html?$/,
    ];
    return opts;
  });
}
