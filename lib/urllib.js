'use strict';

const urllib = require('urllib');
const pathToRegexp = require('path-to-regexp');
const qs = require('qs');
const utils = require('./utils');
const url = require('url');
const formstream = require('formstream');
const debug = require('debug')('hc-proxy');

module.exports = function (u, proxyHeaders) {
  let log = u.log;
  let endpoint = u.endpoint;
  let route = u.route;
  let method = u.method;
  let client = u.client;
  let timeout = u.timeout;

  let routeKeys = [];
  let routePathGrep = pathToRegexp(u.route, routeKeys, utils.pathToRegexpOption);

  return (req, callback) => {
    let path = u.path;
    let options = {};
    options.method = req.method;
    options.data = ['GET', 'DELETE'].indexOf(req.method) !== -1 ? req.query : req.body;
    options.contentType = 'json';
    options.dataType = 'json';
    options.timeout = timeout || 60000;
    options.headers = {};
    proxyHeaders.map(h => {
      h = h.toLowerCase();
      if (req.headers[h]) {
        options.headers[h] = '' + req.headers[h];
      }
    });
    let headers = Object.assign({}, utils.calculateHeaderExtension(req, Object.assign({}, u, u.serviceCfg)), u.headers);
    Object.assign(options.headers, headers);

    path = utils.processUrl(path, routeKeys, routePathGrep, req);

    let defaultQuery = u.defaultQuery instanceof Object ? u.defaultQuery : qs.parse(u.defaultQuery);
    let customerQuery = qs.parse(url.parse(req.url).query);
    if (['GET', 'DELETE'].indexOf(req.method) !== -1) {
      path = utils.mergeQuery(path, defaultQuery, customerQuery, true);
    } else {
      path = utils.mergeQuery(path, defaultQuery, customerQuery);
    }

    // upload file
    if (u.file && req.files && req.files.length) {
      const form = formstream();
      const data = options.data || {};
      Object.keys(data).forEach(k => {
        form.field(k, data[k]);
      });
      options.data = null;
      req.files.forEach(f => {
        form.buffer(f.fieldname, f.buffer, f.originalname);
      });

      options.headers = form.headers(options.headers);
      options.stream = form;
    }

    options.streaming = true;

    if ('DELETE' === req.method && u.useQuerystringInDelete) {
      options.dataAsQueryString = true;
    }
    Object.assign(options, u.urllibOption);

    log.debug('request: ', endpoint + path, options);
    debug('request: ', endpoint + path, options);
    urllib.request(endpoint + path, options, function (err, data, res) {
      callback(err, res, 'stream');
    });
  }
}
