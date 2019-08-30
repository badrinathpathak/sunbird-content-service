/**
 * file: nlp-route.js
 * author: Badri Nath
 * desc: route file for content-nlp
 */
// var contentService = require('../service/contentService')
var nlpService = require('../service/nlpService')
var requestMiddleware = require('../middlewares/request.middleware')
var filterMiddleware = require('../middlewares/filter.middleware')
var healthService = require('../service/healthCheckService')

var BASE_URL = '/v1/content/nlp'
var dependentServiceHealth = ['EKSTEP']

module.exports = function (app) {
  app.route(BASE_URL + '/search')
    .post(healthService.checkDependantServiceHealth(dependentServiceHealth),
      requestMiddleware.createAndValidateRequestBody, filterMiddleware.addMetaFilters,
      nlpService.searchAPI)
}
