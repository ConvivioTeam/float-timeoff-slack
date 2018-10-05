require('dotenv').config()
var https = require('https');
var slack = require('slack-incoming-webhook');
var send = slack({
  url: process.env.SLACK_WEBHOOK_URL,
});
var moment = require('moment');
var now = moment();

var timeOff = null;
var message = null;

function getTimeOff(callback) {
  var options = {
    host: 'api.float.com',
    port: 443,
    path: '/v3/timeoffs',
    headers: {
      'Authorization' : 'Bearer ' + process.env.FLOAT_ACCESS_TOKEN
    }
  };
  return https.get(options, function(response) {
      // Continuously update stream with data
      var body = '';
      response.on('data', function(d) {
          body += d;
      });
      response.on('end', function() {
        console.log(body);
          // Data reception is done, do whatever with it!
          timeOff = JSON.parse(body);
          callback();
      });
  }).on('error', (e) => {
    console.error(e);
  });;
}

function filterTimeOff(callback) {
  console.log('filter');
  timeOff.forEach( function(element, index) {
    var inRange = false;
    var startDate = element.start_date;
    var endDate = element.end_date;
    if(
      (moment(now).isBefore(endDate, 'day') || moment(now).isSame(endDate, 'day'))
      &&
      (moment(now).isAfter(startDate, 'day') || moment(now).isSame(startDate, 'day'))
    ) {
      inRange = true;
    }
    element.in_range = inRange;
    timeOff[index] = element;
  });
  callback();
}

function getPeople(callback) {
  var counter = 0;
  timeOff.forEach( function(element, index) {
    var id = element.people_ids[0];
    var options = {
      host: 'api.float.com',
      port: 443,
      path: '/v3/people/' + id,
      headers: {
        'Authorization' : 'Bearer ' + process.env.FLOAT_ACCESS_TOKEN
      }
    };
    console.log(options);
    https.get(options, function(response) {
        // Continuously update stream with data
        var body = '';
        response.on('data', function(d) {
            body += d;
        });
        response.on('end', function() {
            // Data reception is done, do whatever with it!
            person = JSON.parse(body);
            element.person = person;
            timeOff[index] = element;
            counter++;

            if(counter === timeOff.length) {
              callback();
            }
        });
    }).on('error', (e) => {
      console.error(e);
    });;
  });
}

function compileSlackMessage(callback) {
  var count = 0;
  timeOff.forEach( function(element, index) {
    if(element.in_range) {
      count++;
    }
  });
  if(count > 1) {
    message = 'There are ' + count + ' people off work today:';
  }
  if (count > 0) {
    message = 'There is ' + count + ' person off work today:';
    timeOff.forEach( function(element, index) {
      if(element.in_range) {
        personName = element.person.name;
        message += ' ' + personName + '.';
      }
    });
    callback();
  }
  else {
    callback();
  }
}

function postToSlack(callback) {
  if (message == null) {
    console.log('Nothing to post');
    callback();
    return;
  }
  else {
    send(message);
    callback();
  }
}

function init() {
  getTimeOff(function() {
    filterTimeOff(function() {
      getPeople(function() {
        compileSlackMessage(function() {
          postToSlack(function() {
            console.log('Done!');
          })
        })
      })
    });
  });
};

init();
