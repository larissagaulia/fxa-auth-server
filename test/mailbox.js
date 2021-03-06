/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var P = require('../lib/promise')
var request = require('request')
const EventEmitter = require('events').EventEmitter

module.exports = function (host, port) {

  host = host || '127.0.0.1'
  port = port || 9001

  const eventEmitter = new EventEmitter()

  function waitForCode(email) {
    return waitForEmail(email)
      .then(
        function (emailData) {
          return emailData.headers['x-verify-code'] ||
                 emailData.headers['x-recovery-code']
        }
      )
  }

  function loop(name, tries, cb) {
    var url = 'http://' + host + ':' + port + '/mail/' + encodeURIComponent(name)
    console.log('checking mail', url)
    request({ url: url, method: 'GET' },
      function (err, res, body) {
        console.log('mail status', res && res.statusCode, 'tries', tries)
        var json = null
        try {
          json = JSON.parse(body)[0]
        }
        catch (e) {
          return cb(e)
        }

        if(!json) {
          if (tries === 0) {
            return cb(new Error('could not get mail for ' + url))
          }
          return setTimeout(loop.bind(null, name, --tries, cb), 1000)
        }
        console.log('deleting mail', url)
        request({ url: url, method: 'DELETE' },
          function (err, res, body) {
            cb(err, json)
          }
        )
      }
    )
  }

  function waitForEmail(email) {
    var d = P.defer()
    loop(email.split('@')[0], 20, function (err, json) {
      if (err) {
        eventEmitter.emit('email:error', email, err)
        return d.reject(err)
      }
      eventEmitter.emit('email:message', email, json)
      return d.resolve(json)
    })
    return d.promise
  }

  return {
    waitForEmail: waitForEmail,
    waitForCode: waitForCode,
    eventEmitter: eventEmitter
  }
}
