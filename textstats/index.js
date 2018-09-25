
'use strict';

///////////////////////////////////////////////////////////////////////////////////////
// Text Stats
///////////////////////////////////////////////////////////////////////////////////////

const aws = require('aws-sdk');

aws.config.update({ region: process.env.AWS_REGION });

const s3 = new aws.S3();
const bucket = 'textstats-results'


function UserException(code, message) {
   this.code = code;
   this.message = message;
}


exports.handler = async (event, context) => {

  var response = {};
  var result = {};

  try {

    // Retrieve persisted result from previous request
    if (event.httpMethod == 'GET') {
      var data = await s3.getObject({ Bucket: bucket, Key: event.pathParameters.requestid }).promise();
      result = JSON.parse(data.Body.toString());
    }

    // Perform actions on text and persist result
    if (event.httpMethod == 'POST') {
      if (!event.queryStringParameters) {
        throw new UserException("NoQueryString", "No query string paramaters found. At least 'action' must be specified!");
      }

      if (event.queryStringParameters.action !== 'sort' &&
          event.queryStringParameters.action !== 'generatestatistics') {

        throw new UserException("NoAction", "Unsupported action. Must be 'sort' or 'generatestatistics'.");
      }

      var json = JSON.parse(event.body);

      if (event.queryStringParameters.action == 'sort') {
        if (!event.queryStringParameters.sortoption) {
          throw new UserException("NoSortOption", "No sortoption parameter found in query string!");
        }

        var sortoption = parseInt(event.queryStringParameters.sortoption);

        if (sortoption < 1 || sortoption > 3) {
          throw new UserException("NoSortOption", "Unsupported sort option. Must be '1', '2' or '3'.");
        }

        // Find words in text
        var words = json.text.match(/\w+/mg);

        // Alphabetic sort (ascending)
        if (sortoption == 1) {
          words.sort();
        }

        // Alphabetic sort (descending)
        if (sortoption == 2) {
          words.sort().reverse();
        }

        // Sort on word length (ascending)
        if (sortoption == 3) {
          words.sort( function(a, b) { return a.length - b.length } );
        }

        result = { 'sorted': words };
      }

      if (event.queryStringParameters.action == "generatestatistics") {
        // Find words/hyphens/spaces in text
        var words = json.text.match(/\w+/mg);
        var hyphens = json.text.match(/-/mg);
        var spaces = json.text.match(/ /mg);

        result = {
                   'TextStatistics': {
                     'words': words.length,
                     'hyphens': hyphens.length,
                     'spaces': spaces.length
                   }
                 };
      }

      // Persist in S3
      var params = {
       Body: JSON.stringify(result), 
       Bucket: bucket, 
       Key: event.requestContext.requestId
      };

      await s3.putObject(params).promise();

      // We include request Id to be able to retrieve persisted data in the future
      result['requestId'] = event.requestContext.requestId;
    }


    // Build function response
    response = {
      'statusCode': 200,
      'body': JSON.stringify(result)
    }

  }
  catch (err) {
    console.log("Error: \n\n" + JSON.stringify(err) + '\n');

    var errortype = 'AWS';
    var statuscode = 500;

    if (err.code) {
      errortype = err.code;
      statuscode = 400;
    }
    
    response = {
      'statusCode': statuscode,
      'headers': {
        'X-Amzn-ErrorType': errortype
      },
      'body': JSON.stringify(err)
    }
  }

  return response;

};
