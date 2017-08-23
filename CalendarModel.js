"use strict"

var doGoogleAuth = require('do-google-auth'),
    google       = require('googleapis'),
    timestamp    = require('internet-timestamp');

require('date-format-lite')

var method = CalendarModel.prototype;

var name
  , calendarId
  , calendarEvents
  , googleAuth
  , gCal
  , log
  , log4js;



/**
 * Calendar Model
 *
 * @classdesc Interface with Google Calendar REST API that takes care of authorization.
 * @namespace calendarModel
 * @version  v1
 * @variation v1
 * @this GmailModel
 * @param {object=} options Options for GCalendar
 * @param {string} appSpecificPassword - allows you to send emails
 * @param {string} emailsFrom - 'From' address on emails
 * @param {string} googleScopes -
 * @param {string} name - Name of this calendar
 * @param {string} tokenDir -
 * @param {string} tokenFile -
 * @param {string} user - Gmail username (for sending emails)
 * @param {string} userId - Gmail userId (defaults to 'me')
 */
function CalendarModel(params) {

  this.name = params.name

  if (!params.hasOwnProperty('calendarId')) {
    id = "--"
  } else {
    this.calendarId = params.calendarId
  }

  this.googleAuth = new doGoogleAuth(
    params.googleScopes,
    params.tokenFile,
    params.tokenDir,
    params.clientSecretFile
  );

  this.calendarEvents = new Array ();

  this.gCal = google.calendar('v3');


  if (params.log4js) {

    this.log4js = params.log4js
    this.log = this.log4js.getLogger('Calendar-' + this.name);
    this.log.setLevel(params.logLevel);

  } else {

    var logStub = function (msg) {/*console.log(msg)*/}

    this.log = {
      dev: logStub,
      debug: logStub,
      error: logStub,
      info: logStub,
      trace: logStub
    }
  }


}


method.addEvent = function (event) {

  this.calendarEvents.push(event);

}

method.addEventToGoogle = function (event, callback) {

  var self = this;

  self.log.info('Adding event to google calendar: ' + self.getEventString(event))

  // Authorize a client with the loaded credentials, then call the
  // Calendar API.
  this.googleAuth.authorize( function (err, auth) {

    if (err) { cb(err); return null }

    self.gCal.events.insert({
      auth : auth,
      calendarId : self.calendarId,
      sendNotifications : true,
      resource : {
        summary : event.summary,
	description : "Created by Raspberry Pi",
        start : {
	  dateTime : event.start.dateTime
        },
        end : {
 	  dateTime : event.end.dateTime
	},
	attendees : event.attendees,
	reminders : {
	  useDefault : true
        }
      }
    }, function(err, newEv) {

      if (err) {
        self.log.error('Failed to add event to calendar: ' + err);
        callback(err)
        return;
      }

      self.log.info('Returned event resource')
      self.log.info(newEv)

      self.addEvent(newEv)
      callback(null,newEv)

    })
  })


}

method.deleteEventFromGoogle = function (event, callback) {
  var self = this
  self.log.info('Deleting Event ' + self.getEventString(event));

  // Authorize a client with the loaded credentials, then call the
  // Calendar API.
  this.googleAuth.authorize( function (err, auth) {

    if (err) { cb(err); return null }

    self.gCal.events.delete({
      auth : auth,
      calendarId : self.calendarId,
      eventId : event.id,
      sendNotifications : true
    }, function(err, cal) {

      if (err) {
        self.log.error('Failed to delete event: ' + err);
        callback(err)
        return null
      }

      self.log.info('+---> Deleted Event ' + self.getEventString(event));
      callback(null)

    })
  })
}

method.getEvents = function () {
	return this.calendarEvents
}

method.getEventString = function (event,params) {

  var s = new Date(event.start.dateTime)
  var e = new Date(event.end.dateTime)

  var sStr = s.format("YYYY-MM-DD hh:mm")
  var eStr = e.format("YYYY-MM-DD hh:mm")

  var id = "--"
  if (event.hasOwnProperty('id')) {
    id = event.id;
  }

  var showTimeZones = (params && params.hasOwnProperty('showTimeZones') && params.showTimeZones)? true : false

  var retStr = '"' + event.summary + '"'
  retStr    += ' (' + id.slice(-8) + ') '
  retStr    += sStr
  if (showTimeZones) { retStr += "(" + event.start.timeZone + ")" }
  retStr    += ' -> ' + eStr;
  if (showTimeZones) { retStr += "(" + event.end.timeZone + ")" }

  return retStr

}


/**
 * List events from google
 *
 * @param {object=}  params
 * @param {integer}  params.maxResults
 * @param {string[]} params.retFields - Optional. The specific resource fields to return in the response.
 * @param {string}   params.textSearch
 * @param {string}   params.timeMin
 * @param {string}   params.timeMax
 * @param {object}   cb - Callback to be called at the end. Returns cb(err,events)
 */
method.listEvents = function(params,cb) {

  var self = this;

  // Authorize a client with the loaded credentials, then call the
  // Calendar API.
  this.googleAuth.authorize( function (err, auth) {

    if (err) { cb(err); return null }

    var args = {
      auth: auth,
      calendarId: self.calendarId,
      orderBy: 'startTime',
      prettyPrint: false,
      singleEvents: true
    }

    // Optional params to send to google
    if (params.hasOwnProperty('retFields'))  { args.fields  = params.retFields.join(',')}
    if (params.hasOwnProperty('textSearch')) { args.q       = params.textSearch }
    if (params.hasOwnProperty('timeMin'))    { args.timeMin = timestamp(params.timeMin) }
    if (params.hasOwnProperty('timeMax'))    { args.timeMax = timestamp(params.timeMax) }

    self.gCal.events.list(args, function(err, cal) {
      if (err) { cb(err); return null }
      cb(null,cal.items)
    });

  });
}

method.loadEventsFromGoogle = function(params,callback) {

  var self = this;


  if (!params.hasOwnProperty('timeMin')) {
    throw new Error('Error in CalendarModel.loadFutureEvents: No start time specified.')
  }
  if (!params.hasOwnProperty('timeMax')) {
    throw new Error('Error in CalendarModel.loadFutureEvents: No end time specified.')
  }
  if (!params.hasOwnProperty('textSearch')) {
    params.textSearch = null
  }

  self.log.info('Loading events in calendar: ' + this.name)
  // Authorize a client with the loaded credentials, then call the
  // Calendar API.
  this.googleAuth.authorize( function (err, auth) {

    if (err) { cb(err); return null }


    var timeMin = timestamp(params.timeMin)
    var timeMax = timestamp(params.timeMax)
    self.log.debug('Period: ' + timeMin + " to " + timeMax)

    self.gCal.events.list({
      auth: auth,
      calendarId: self.calendarId,
      orderBy: 'startTime',
      showDeleted: false,
      singleEvents: true,
      timeMin: timeMin,
      timeMax: timeMax,
      q: params.textSearch
    }, function(err, cal) {

      if (err) {
        self.log.error('calendarModel.loadEventsFromGoogle: The API returned an error: ' + err);
        return;
      }

      var events = cal.items;
      if (events.length == 0) {

        self.log.info('No calendar entries found.');

      } else {

        self.log.info('Events:');
        self.log.info('|');
        for (var i = 0; i < events.length; i++) {

          var event = events[i];

	  try {
            self.log.info('+-> ' + self.getEventString(event));
            self.addEvent (event)
	  } catch (err) {
	    self.log.error('ERROR! Could not add event: ' + err)
	    self.log.error('Raw resource is:')
	    self.log.error(event)
	  }

        }
      }

      callback(events)

    });

  });
};

/**
 * Update event (deprecated)
 *
 * @param {object}   event - A google event representation
 */
method.updateEventOnGoogle = function (params,cb) {
  var self = this
  self.log.info ('Updating Event ' + self.getEventString(event));

  // Authorize a client with the loaded credentials, then call the
  // Calendar API.
  this.googleAuth.authorize( function (err, auth) {

    if (err) { cb(err); return null }

    self.gCal.events.update({
      auth : auth,
      calendarId : self.calendarId,
      eventId : event.id,
      sendNotifications : true,
      resource : event
    }, function(err, cal) {

      if (err) {
        self.log.error('Failed to update event: ' + err);
        return;
      }

      self.log.info('Returned event resource')
      self.log.info(cal)

    })
  })
}

/**
 * Update event
 *
 * @param {object}   params
 * @param {integer}  params.id
 * @param {boolean}  params.patchOnly - Optional. If true, it uses PATCH semantics so only specific fields are required rather than a whole event resource.
 * @param {string[]} params.retFields - Optional. The specific resource fields to return in the response.
 * @param {object}   params.resource - The updated event resource
 * @param {object}   cb - Callback to be called at the end. Returns cb(err,event)
 * @returns {object} A google event representation
 */
method.updateEvent = function (params, cb) {

  var self = this

  // Authorize a client with the loaded credentials, then call the Calendar API.
  this.googleAuth.authorize( function (err, auth) {

    if (err) { cb(err); return null }

    var gParams = {
      auth: auth,
      calendarId: self.calendarId,
      eventId: params.id,
      sendNotifications: true,
      resource: params.resource,
      prettyPrint: false
    }

    if (params.hasOwnProperty('retFields')) { gParams.fields = params.retFields.join(',')}

    // Do a full update or just a patch?
    var updateOp = "update"
    if (params.hasOwnProperty('patchOnly') && params.patchOnly) {updateOp = "patch"}

    self.gCal.events[updateOp](gParams, function(err, ev) {
      if (err) { cb(err); return; }
      cb(null, ev)
    })
  })
}





// export the class
module.exports = CalendarModel;
