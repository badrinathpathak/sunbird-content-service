/**
 * @name : nlpService.js
 * @description :: Responsible for handle content nlp search Service
 * @author      :: Badri Nath
 */

var async = require('async')
var respUtil = require('response_util')
var logger = require('sb_logger_util_v2')
// var contentService = require('../service/contentService')
var messageUtils = require('./messageUtil')
var utilsService = require('../service/utilsService')
var contentProvider = require('sb_content_provider_util')
var contentMessage = messageUtils.CONTENT
// var compositeMessage = messageUtils.COMPOSITE
var responseCode = messageUtils.RESPONSE_CODE
// var reqMsg = messageUtils.REQUEST
var lodash = require('lodash')
var orgHelper = require('../helpers/orgHelper')

var CacheManager = require('sb_cache_manager')
var cacheManager = new CacheManager({})

/**
 * This function return the contentType for create course
 * @returns {String}
 */
function getContentTypeForContent() {
  return contentMessage.CONTENT_TYPE
}

function searchAPI(req, response) {
  return search(getContentTypeForContent(), req, response, ['Content'])
}

function search(defaultContentTypes, req, response, objectType) {
  var data = req.body
  var rspObj = req.rspObj

  logger.info({
    msg: 'contentService.search() called', additionalInfo: { rspObj }
  }, req)

  if (!data.request || !data.request.filters) {
    rspObj.errCode = contentMessage.SEARCH.MISSING_CODE
    rspObj.errMsg = contentMessage.SEARCH.MISSING_MESSAGE
    rspObj.responseCode = responseCode.CLIENT_ERROR

    logger.error({
      msg: 'Error due to required request || request.filters are missing',
      err: {
        errCode: rspObj.errCode,
        errMsg: rspObj.errMsg,
        responseCode: rspObj.responseCode
      },
      additionalInfo: { data }
    }, req)

    return response.status(400).send(respUtil.errorResponse(rspObj))
  }

  if (!data.request.filters) {
    data.request.filters.contentType = defaultContentTypes
  }

  // if fields exists it has to be sent as array to lp
  if (req.query.fields) {
    data.request.fields = req.query.fields.split(',')
  }
  if (objectType) {
    data.request.filters.objectType = objectType
  }
  //    if(!data.request.filters.mimeType) {
  //        data.request.filters.mimeType = getMimeTypeForContent();
  //    }

  var ekStepReqData = {
    request: data.request
  }

  async.waterfall([

    function (CBW) {
      logger.info({
        msg: 'Request to content provider to search the content',
        additionalInfo: {
          body: ekStepReqData
        }
      }, req)

      contentProvider.compositeSearch(ekStepReqData, req.headers, function (err, res) {
        console.log(" @@@@compositeSearch searc function res 1 @@@ : ", JSON.stringify(res))
        if (err || res.responseCode !== responseCode.SUCCESS) {
          rspObj.errCode = res && res.params ? res.params.err : contentMessage.SEARCH.FAILED_CODE
          rspObj.errMsg = res && res.params ? res.params.errmsg : contentMessage.SEARCH.FAILED_MESSAGE
          rspObj.responseCode = res && res.responseCode ? res.responseCode : responseCode.SERVER_ERROR
          logger.error({
            msg: 'Getting error from content provider composite search',
            err: {
              err,
              errCode: rspObj.errCode,
              errMsg: rspObj.errMsg,
              responseCode: rspObj.responseCode
            },
            additionalInfo: { ekStepReqData }
          }, req)
          var httpStatus = res && res.statusCode >= 100 && res.statusCode < 600 ? res.statusCode : 500
          rspObj.result = res && res.result ? res.result : {}
          rspObj = utilsService.getErrorResponse(rspObj, res)
          return response.status(httpStatus).send(respUtil.errorResponse(rspObj))
        } else {
          if (res.result && res.result.count === 0) {
            // console.log(" @@@@calling searc nlp function @@@ : ", JSON.stringify(res))
            searchNLP(req, function (err, nlpSearchRes) {
              console.log(" @@@@nlp searc function res 2 @@@ : ", JSON.stringify(nlpSearchRes))
              if (err) {
                console.log("error response 3 ", err)
                return response.status(400).send(err)
              } else {
                console.log("success response 4 ", JSON.stringify(nlpSearchRes))
                // CBW(null, nlpSearchRes)
                res = nlpSearchRes
                console.log(" @@@@ else  searc function res 5 @@@ : ", JSON.stringify(res))
                if (req.query.framework && req.query.framework !== 'null') {
                  console.log(" @@@@ calling framework get 6 @@@ : ")
                  getFrameworkDetails(req, function (err, data) {
                    if (err || res.responseCode !== responseCode.SUCCESS) {
                      console.log(" @@@@ err  framework get 7 data @@@ : ")
                      logger.error({ msg: `Framework API failed with framework - ${req.query.framework}`, err }, req)
                      rspObj.result = res.result
                      return response.status(200).send(respUtil.successResponse(rspObj))
                    } else {
                      console.log(" @@@@ success  searc function res 8 @@@ : ", JSON.stringify(data))
                      var language = req.query.lang ? req.query.lang : 'en'
                      if (lodash.get(res, 'result.facets') &&
                        lodash.get(data, 'result.framework.categories')) {
                        modifyFacetsData(res.result.facets, data.result.framework.categories, language)
                      }
                      orgHelper.includeOrgDetails(req, res, CBW)
                    }
                  })
                } else {
                  console.log(" @@@@ else  searc function res 9 @@@ : ", JSON.stringify(res))
                  orgHelper.includeOrgDetails(req, res, CBW)
                }
              }
            })
          } else {
            console.log(" @@@@ else  searc function res 10 @@@ : ", JSON.stringify(res))
            if (req.query.framework && req.query.framework !== 'null') {
              console.log(" @@@@ calling framework get 11 @@@ : ")
              getFrameworkDetails(req, function (err, data) {
                if (err || res.responseCode !== responseCode.SUCCESS) {
                  console.log(" @@@@ err  framework get 12 data @@@ : ")
                  logger.error({ msg: `Framework API failed with framework - ${req.query.framework}`, err }, req)
                  rspObj.result = res.result
                  return response.status(200).send(respUtil.successResponse(rspObj))
                } else {
                  console.log(" @@@@ success  searc function res 13 @@@ : ", JSON.stringify(data))
                  var language = req.query.lang ? req.query.lang : 'en'
                  if (lodash.get(res, 'result.facets') &&
                    lodash.get(data, 'result.framework.categories')) {
                    modifyFacetsData(res.result.facets, data.result.framework.categories, language)
                  }
                  orgHelper.includeOrgDetails(req, res, CBW)
                }
              })
            } else {
              console.log(" @@@@ else  searc function res 14 @@@ : ", JSON.stringify(res))
              orgHelper.includeOrgDetails(req, res, CBW)
            }
          }
        }
      })
    },

    function (res) {
      rspObj.result = res.result
      logger.info({
        msg: `Content searched successfully with ${lodash.get(rspObj.result, 'count')}`,
        additionalInfo: {
          contentCount: lodash.get(rspObj.result, 'count')
        }
      }, req)
      console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@final output @@@@@@@@@@@@@@@@@@@@@", JSON.stringify(rspObj))
      return response.status(200).send(respUtil.successResponse(rspObj))
    }
  ])
}

function getFrameworkDetails(req, CBW) {
  cacheManager.get(req.query.framework, function (err, data) {
    if (err || !data) {
      contentProvider.getFrameworkById(req.query.framework, '', req.headers, function (err, result) {
        if (err || result.responseCode !== responseCode.SUCCESS) {
          logger.error({ msg: `Fetching framework data failed ${lodash.get(req.query, 'framework')}`, err }, req)
          CBW(new Error('Fetching framework data failed'), null)
        } else {
          logger.info({ msg: `Fetching framework data success ${lodash.get(req.query, 'framework')}` }, req)
          cacheManager.set({ key: req.query.framework, value: result },
            function (err, data) {
              if (err) {
                logger.error({ msg: `Setting framework cache data failed ${lodash.get(req.query, 'framework')}`, err }, req)
              } else {
                logger.info({ msg: `Setting framework cache data success ${lodash.get(req.query, 'framework')}` }, req)
              }
            })
          CBW(null, result)
        }
      })
    } else {
      CBW(null, data)
    }
  })
}

function modifyFacetsData(searchData, frameworkData, language) {
  lodash.forEach(searchData, (facets) => {
    lodash.forEach(frameworkData, (categories) => {
      if (categories.code === facets.name) {
        lodash.forEach(facets.values, (values) => {
          lodash.forEach(categories.terms, (terms) => {
            if (values.name.toLowerCase() === terms.name.toLowerCase()) {
              terms = lodash.pick(terms, ['name', 'translations', 'description',
                'index', 'count'])
              Object.assign(values, terms)
              values.translations = parseTranslationData(terms.translations, language)
            }
          })
        })
        facets.values = lodash.orderBy(facets.values, ['index'], ['asc'])
      }
    })
  })
}

function parseTranslationData(data, language) {
  try {
    return lodash.get(JSON.parse(data), language) || null
  } catch (e) {
    logger.warn({ msg: 'warning from parseTranslationData()', warningMessage: e })
    return null
  }
}

function searchNLP(req, done) {
  var data = req.body.request
  var rspObj = req.rspObj
  console.log('in search')
  logger.info({
    msg: 'contentService.nlp.searchAPI() called', additionalInfo: { rspObj }
  }, req)
  logger.info({ msg: ' data' }, data)

  if (!data || !data.query) {
    rspObj.errCode = contentMessage.NLP_SEARCH.MISSING_CODE
    rspObj.errMsg = contentMessage.NLP_SEARCH.MISSING_MESSAGE
    rspObj.responseCode = responseCode.CLIENT_ERROR

    logger.error({
      msg: 'Error due to required request || request.query are missing',
      err: {
        errCode: rspObj.errCode,
        errMsg: rspObj.errMsg,
        responseCode: rspObj.responseCode
      },
      additionalInfo: { data }
    }, req)

    done(respUtil.errorResponse(rspObj), null)
  }

  var ekStepReqData = {
    searchString: data.query
  }

  async.waterfall([

    function (CBW) {
      logger.info({
        msg: 'Request to content provider to search the content',
        additionalInfo: {
          query: ekStepReqData
        }
      }, req)
      contentProvider.nlpContentSearch(ekStepReqData, req.headers, function (err, res) {
        if (err || res.responseCode !== responseCode.SUCCESS) {
          logger.error({ msg: `Fetching nlp-search data failed ${lodash.get(ekStepReqData.searchString, 'searchString')}`, err }, req)
          rspObj.result = res && res.result ? res.result : {}
          logger.error({
            msg: 'Error from content nlp search in nlp service',
            err,
            additionalInfo: { ekStepReqData }
          }, req)
          rspObj = utilsService.getErrorResponse(rspObj, res, contentMessage.NLP_SEARCH)
          done(respUtil.errorResponse(rspObj), null)
        } else {
          logger.info({ msg: `Fetching searchString data success ${lodash.get(req.query, 'searchString')}` }, req)
          CBW(null, res)
        }
      })
    },
    function (res) {
      rspObj.result = res.result
      logger.info({
        msg: `Content nlp searched successfully with ${lodash.get(rspObj.result, 'count')}`,
        additionalInfo: {
          contentCount: lodash.get(rspObj.result, 'count')
        }
      }, req)
      logger.info({
        msg: 'Content nlp searched successfully with '
      }, res)
      console.log('new api final response', JSON.stringify(respUtil.successResponse(res)))
      done(null, respUtil.successResponse(res))
    }
  ])
}

// function searchAPI (resq, response) {
//   contentService.searchContentAPI(req, response, function (searchReponse) {
//     console.log('@@@@@@ old response')
//     console.log(JSON.stringify(searchReponse))
//     if (searchReponse && searchReponse.result.count === 0 && searchReponse.responseCode === responseCode.SUCCESS) {
//       return search(req, response)
//     } else {
//       return searchReponse
//     }
//   })
// }

module.exports.searchAPI = searchAPI
