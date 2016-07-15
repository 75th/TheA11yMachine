'use strict';

var _      = require('underscore');
var crypto = require('crypto');
var fs     = require('fs');
var mkdirp = require('mkdirp');

module.exports = {
    config: config,
    error: reportError,
    debug: emptyFunction,
    info: emptyFunction,
    results: reportResults,
    codesReport: codesReport
};

var outputDirectory = null;
var indexHtmlStream = null;
var statistics      = [];
var resultsData    = [];

function emptyFunction() {}

function config(options) {
    outputDirectory = options.outputDirectory;
    mkdirp.sync(outputDirectory);
    indexHtmlStream = fs.createWriteStream(
        outputDirectory + '/index.html',
        {
            flag: 'a',
            defaultEncoding: 'utf8'
        }
    );

    var indexDotHtml = _.template(
        fs.readFileSync(__dirname + '/../view/reports/index.html', {encoding: 'utf-8'})
    );

    indexHtmlStream.write(
        indexDotHtml(
            {
                date: new Date(),
                css : {
                    common: fs.readFileSync(__dirname + '/../view/common.css', {encoding: 'utf-8'})
                }
            }
        )
    );
}

function reportError(message) {
    console.error(message);
}

function reportResults(results, url) {
    var hash = crypto.createHash('sha1').update(url).digest('hex');

    var noteCodes    = {};
    var errorCount   = 0;
    var warningCount = 0;
    var noticeCount  = 0;

    results.forEach(
        function(result, index) {
            if (true === /Principle.+Guideline/.test(result.code)) {
                result.noteCodes = result.code.split('.')[4].split(',');
            } else {
                result.noteCodes = [];
            }

            result.noteCodes.forEach(
                function (value) {
                    noteCodes[value] = value;
                }
            );

            if (true === isError(result)) {
                ++errorCount;
            } else if (true === isWarning(result)) {
                ++warningCount;
            } else if (true === isNotice(result)) {
                ++noticeCount;
            }
        }
    );

    noteCodes = Object.keys(noteCodes);

    var total             = Math.max(errorCount + warningCount + noticeCount, 1);
    var errorPercentage   = (errorCount * 100) / total;
    var warningPercentage = (warningCount * 100) / total;
    var noticePercentage  = (noticeCount * 100) / total;

    var reportDotHtml = _.template(
        fs.readFileSync(__dirname + '/../view/reports/report.html', {encoding: 'utf-8'})
    );
    var indexReportDotHtml = _.template(
        fs.readFileSync(__dirname + '/../view/reports/index-report.html', {encoding: 'utf-8'})
    );

    var options = {
        url              : url,
        reportUrl        : './' + hash + '.html',
        date             : new Date(),
        errorCount       : errorCount,
        errorPercentage  : errorPercentage,
        warningCount     : warningCount,
        warningPercentage: warningPercentage,
        noticeCount      : noticeCount,
        noticePercentage : noticePercentage,
        results          : results,
        noteCodes        : noteCodes,
        css              : {
            common: fs.readFileSync(__dirname + '/../view/common.css', {encoding: 'utf-8'})
        }
    };

    statistics.push({
        url         : url,
        hash        : hash,
        date        : new Date(),
        errorCount  : errorCount,
        warningCount: warningCount,
        noticeCount : noticeCount
    });

    fs.writeFileSync(
        outputDirectory + '/' + hash + '.html',
        reportDotHtml(options),
        {
            flag    : 'w',
            encoding: 'utf8'
        }
    );
    indexHtmlStream.write(indexReportDotHtml(options));
    fs.writeFileSync(
        outputDirectory + '/statistics.json',
        JSON.stringify(statistics),
        {
            flag    : 'w',
            encoding: 'utf8'
        }

    );

    // Store all results
    resultsData.push(results);

    fs.writeFileSync(
        outputDirectory + '/results.json',
        JSON.stringify(resultsData),
        {
            flag    : 'w',
            encoding: 'utf8'
        }

    );
}

function codesReport(options) {
    outputDirectory = options.outputDirectory;
    mkdirp.sync(outputDirectory);

    var resultsJson = JSON.parse(fs.readFileSync(outputDirectory + '/results.json', 'utf8'));
    var codes = [];

    _.each(resultsJson, function(urls) {
        _.each(urls, function(obj) {
            var match = _.where(codes, {code: obj.code});
            var url = {url: obj.url, context: obj.context, selector: obj.selector};
            if (match.length == 0) {
                var hash = crypto.createHash('sha1').update(obj.code).digest('hex');
                codes.push({
                    type: obj.type,
                    level: obj.level,
                    code: obj.code,
                    reportUrl: './' + hash + '.html',
                    message: obj.message,
                    instances: 1,
                    urls: [url]
                });
            }
            else {
                ++match[0].instances;
                match[0].urls.push(url);
            }
        });
    });

    codes = _.sortBy(codes, function(o) { return -o.instances; });

    // Codes index page
    var indexDotHtml = _.template(
        fs.readFileSync(__dirname + '/../view/reports/codes/index.html', {encoding: 'utf-8'})
    );

    var options = {
        url: options.url,
        date : new Date(),
        codes: codes,
        css  : {
            common: fs.readFileSync(__dirname + '/../view/common.css', {encoding: 'utf-8'})
        }
    };

    fs.writeFileSync(
        outputDirectory + '/index-codes.html',
        indexDotHtml(options),
        {
            flag    : 'w',
            encoding: 'utf8'
        }
    );

    // Code report page
    var codeReportDotHtml = _.template(
        fs.readFileSync(__dirname + '/../view/reports/codes/report.html', {encoding: 'utf-8'})
    );

    _.each(codes, function(code) {
        var hash = crypto.createHash('sha1').update(code.code).digest('hex');

        var options = {
            date : new Date(),
            code: code,
            css  : {
                common: fs.readFileSync(__dirname + '/../view/common.css', {encoding: 'utf-8'})
            }
        }

        fs.writeFileSync(
            outputDirectory + '/' + hash + '.html',
            codeReportDotHtml(options),
            {
                flag    : 'w',
                encoding: 'utf8'
            }
        );
    });

}

function upperCaseFirst(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function isError(result) {
    return (result.level === 'error');
}

function isNotice(result) {
    return (result.level === 'notice');
}

function isWarning(result) {
    return (result.level === 'warning');
}

// Polyfill from
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from#Polyfill.
if (!Array.from) {
    Array.from = (function () {
        var toStr = Object.prototype.toString;
        var isCallable = function (fn) {
            return typeof fn === 'function' || toStr.call(fn) === '[object Function]';
        };
        var toInteger = function (value) {
            var number = Number(value);
            if (isNaN(number)) { return 0; }
            if (number === 0 || !isFinite(number)) { return number; }
            return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number));
        };
        var maxSafeInteger = Math.pow(2, 53) - 1;
        var toLength = function (value) {
            var len = toInteger(value);
            return Math.min(Math.max(len, 0), maxSafeInteger);
        };

        // The length property of the from method is 1.
        return function from(arrayLike/*, mapFn, thisArg */) {
            // 1. Let C be the this value.
            var C = this;

            // 2. Let items be ToObject(arrayLike).
            var items = Object(arrayLike);

            // 3. ReturnIfAbrupt(items).
            if (arrayLike == null) {
                throw new TypeError("Array.from requires an array-like object - not null or undefined");
            }

            // 4. If mapfn is undefined, then let mapping be false.
            var mapFn = arguments.length > 1 ? arguments[1] : void undefined;
            var T;
            if (typeof mapFn !== 'undefined') {
                // 5. else
                // 5. a If IsCallable(mapfn) is false, throw a TypeError exception.
                if (!isCallable(mapFn)) {
                    throw new TypeError('Array.from: when provided, the second argument must be a function');
                }

                // 5. b. If thisArg was supplied, let T be thisArg; else let T be undefined.
                if (arguments.length > 2) {
                    T = arguments[2];
                }
            }

            // 10. Let lenValue be Get(items, "length").
            // 11. Let len be ToLength(lenValue).
            var len = toLength(items.length);

            // 13. If IsConstructor(C) is true, then
            // 13. a. Let A be the result of calling the [[Construct]] internal method of C with an argument list containing the single item len.
            // 14. a. Else, Let A be ArrayCreate(len).
            var A = isCallable(C) ? Object(new C(len)) : new Array(len);

            // 16. Let k be 0.
            var k = 0;
            // 17. Repeat, while k < len… (also steps a - h)
            var kValue;
            while (k < len) {
                kValue = items[k];
                if (mapFn) {
                    A[k] = typeof T === 'undefined' ? mapFn(kValue, k) : mapFn.call(T, kValue, k);
                } else {
                    A[k] = kValue;
                }
                k += 1;
            }
            // 18. Let putStatus be Put(A, "length", len, true).
            A.length = len;
            // 20. Return A.
            return A;
        };
    }());
}
