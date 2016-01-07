"use strict"

var google       = require('googleapis');
var doGoogleAuth = require('do-google-auth');
var timestamp    = require('internet-timestamp');

var method = CalendarModel.prototype;

var name
  , calendarId
  , calendarEvents
  , googleAuth
  , gCal
  , log
  , log4js;




function CalendarModel(params) {

  this.name         = params.name
  this.calendarId   = params.calendarId

  googleAuth = new doGoogleAuth(
    params.googleScopes,
    params.tokenFile,
    params.tokenDir, 
    params.clientSecretFile
  ); 

  this.googleAuth = params.googleAuth;

  this.calendarEvents = new Array ();

  this.gCal = google.calendar('v3');


  this.log4js = params.log4js
  this.log = this.log4js.getLogger('Calendar-' + this.name);
  this.log.setLevel(params.logLevel);
}


method.addEvent = function (event) {

  this.calendarEvents.push(event);

}

method.addEventToGoogle = function (event) {

  var self = this;

  self.log.info('Adding event to google calendar: ' + self.getEventString(event))

  // Authorize a client with the loaded credentials, then call the
  // Calendar API.
  googleAuth.authorize( function (auth) {

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
    }, function(err, cal) {
    
      if (err) {
        self.log.error('Failed to add event to calendar: ' + err);
        return;
      }
    
      self.log.info('Returned event resource')
      self.log.info(cal)

      self.addEvent(cal)
    
    })
  })


}

method.deleteEventFromGoogle = function (event) {
  var self = this
  self.log.info('Deleting Event ' + self.getEventString(event));

  // Authorize a client with the loaded credentials, then call the
  // Calendar API.
  googleAuth.authorize( function (auth) {

    self.gCal.events.delete({
      auth : auth,
      calendarId : self.calendarId,
      eventId : event.id,
      sendNotifications : true
    }, function(err, cal) {
    
      if (err) {
        self.log.error('Failed to delete event: ' + err);
        throw new Error('Failed to delete event: ' + err);
      }
    
      self.log.info('+---> Deleted Event ' + self.getEventString(event));
    
    })
  })
}

method.getEvents = function () {
	return this.calendarEvents
}

method.getEventString = function (event) {

  var s = new Date(event.start.dateTime)
  var e = new Date(event.end.dateTime)

  var sStr = s.getFullYear() + '-' + this.padNumber((s.getMonth() + 1),2)+ '-' + this.padNumber(s.getDate(),2) + ' ' + this.padNumber(s.getHours(),2) + ':' + this.padNumber(s.getMinutes(),2);
  var eStr = e.getFullYear() + '-' + this.padNumber((e.getMonth() + 1),2)+ '-' + this.padNumber(e.getDate(),2) + ' ' + this.padNumber(e.getHours(),2) + ':' + this.padNumber(e.getMinutes(),2);

  var retStr = '"' + event.summary + '"' + ' (' + event.id.slice(-8) + ') ' + sStr + ' -> ' + eStr;
  return retStr
  
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
  googleAuth.authorize( function (auth) {


    var timeMin = timestamp(params.timeMin)
    var timeMax = timestamp(params.timeMax)
    self.log.debug('Period: ' + timeMin + " to " + timeMax)

    self.gCal.events.list({
      auth: auth,
      calendarId : self.calendarId,
      maxResults: 50,
      showDeleted: false,
      singleEvents: true,
      timeMin: timeMin,
      timeMax: timeMax,
      q: params.textSearch
    }, function(err, cal) {

      if (err) {
        self.log.error('The API returned an error: ' + err);
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

      callback()

    });

  });
};


method.padNumber = function (num,size) {
  var s = num+"";
  while (s.length < size) s = "0" + s;
  return s;
}

method.updateEventOnGoogle = function (event) {
  var self = this
  self.log.info ('Updating Event ' + self.getEventString(event));

  // Authorize a client with the loaded credentials, then call the
  // Calendar API.
  googleAuth.authorize( function (auth) {

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





// export the class
module.exports = CalendarModel;
