// This is a slightly modified variant of the compact formatter
// https://raw.githubusercontent.com/eslint/eslint/master/lib/formatters/compact.js

/**
 * @fileoverview Compact reporter
 * @author Nicholas C. Zakas
 */
"use strict";

//------------------------------------------------------------------------------
// Helper Functions
//------------------------------------------------------------------------------

function getMessageType(message) {
    if (message.fatal || message.severity === 2) {
        return "Error";
    } else {
        return "Warning";
    }
}


//------------------------------------------------------------------------------
// Public Interface
//------------------------------------------------------------------------------

module.exports = function(results) {

    let output = "";
    let  total = 0;

    results.forEach(function(result) {

        const messages = result.messages;
        total += messages.length;

        messages.forEach(function(message) {

            output += result.filePath + ":";
            output += (message.line || 0);
            output += ":" + (message.column || 0);
            output += ": " + getMessageType(message);
            output += " - " + message.message;
            output += message.ruleId ? " /* eslint " + message.ruleId + ":0 */" : "";
            output += "\n";
        });

    });

    if (total > 0) {
        output += "\n" + total + " problem" + (total !== 1 ? "s" : "");
    }

    return output;
};
