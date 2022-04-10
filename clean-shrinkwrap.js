#!/usr/bin/env node
'use strict';

const fs = require('fs');
const pjson = require('./package.json');

function clean(lockFileName) {

    const options = {
        removeDev: true
    };
    for (var i = 2; i < process.argv.length; ++i) {
        var arg = process.argv[i];
        if (arg === '-h' || arg === '--help') {
            var help = [
                "",
                "  " + pjson.name + ", version " + pjson.version,
                "",
                "  Options:",
                "",
                "    -h, --help                    print usage information and exit",
                "        --version                 print version and exit",
                "",
                "        --[no-]remove-dev",
                "                                  [don't] remove devDependencies from the lock file",
                ""
            ];
            console.log(help.join("\n"));
            return;
        } else if (arg === '--version') {
            console.log(pjson.version);
            return;
        } else if (arg === '--remove-dev') {
            options.removeDev = true;
        } else if (arg === '--no-remove-dev') {
            options.removeDev = false;
        }
    }

    var ACTION = {
        KEEP: function () {
            return function (object, property, path) {
            };
        },
        REMOVE: function () {
            return function (object, property, path) {
                delete object[property];
            };
        },
        FAIL: function (message) {
            return function (object, property, path) {
                throw new Error('handling of property "' + property + '" failed at ' + path + ': ' + message);
            };
        },
        WARN: function (message) {
            return function (object, property, path) {
                console.log('handling of property "' + property + '" failed at ' + path + ': ' + message);
            };
        }
    };

    function applyRule(rule, object, property, path) {
        if (typeof rule === 'object') {
            applyRules(rule, object[property], path + '/' + JSON.stringify(property));
        } else if (typeof rule === 'function') {
            rule(object, property, path);
        } else {
            throw Error('failed to apply bad or incomplete rule at ' + path);
        }
    }

    function applyRules(rules, object, path) {
        for (var property in object) {
            if (object.hasOwnProperty(property)) {
                if (options.removeDev && object[property].dev && object[property].dev === true) {
                    delete object[property];
                } else if (rules.hasOwnProperty(property)) {
                    applyRule(rules[property], object, property, path);
                } else {
                    if (property === '*') {
                        throw Error('handling of property "' + property + '" failed at ' + path + ': ' + 'invalid property');
                    }
                    applyRule(rules['*'], object, property, path);
                }
            }
        }
    }

    var rules = {
        'name': ACTION.KEEP(),
        'version': ACTION.KEEP(),
        'lockfileVersion': ACTION.KEEP(),
        'requires': ACTION.KEEP(),
        'dependencies': {
            '*': {
                'version': ACTION.KEEP(),
                'optional': ACTION.KEEP(),
                'integrity': ACTION.REMOVE(),
                'from': ACTION.REMOVE(),
                'resolved': ACTION.REMOVE(),
                'requires': ACTION.KEEP(),
                'dev': ACTION.FAIL('dev dependencies should not be included in the lock file, please create the lock file without dev dependencies via npm shrinkwrap --production or rerun the script with the flag --remove-dev'),
                'dependencies': {
                    // will be filled out below
                },
                '*': ACTION.WARN('yet unknown property, please file a bug to add support for this property')
            }
        },
        '*': ACTION.WARN('yet unknown property, please file a bug to add support for this property')
    };
    // fill out the recursive reference
    rules['dependencies']['*']['dependencies'] = rules['dependencies'];

    try {
        console.log('Cleaning ' + lockFileName + ' file...');
        if (!fs.existsSync(lockFileName)) {
            throw new Error('could not open lock file "' + lockFileName + '"');
        }

        var lockFileObject = JSON.parse(fs.readFileSync(lockFileName, 'utf8'));
        applyRules(rules, lockFileObject, '');
        fs.writeFileSync(lockFileName, JSON.stringify(lockFileObject, null, 2) + "\n");
        console.log('Cleaning complete');
    } catch (err) {
        console.error('Cleaning failed: Error: ' + err.message);
        process.exitCode = 1;
    }
}

clean('../../tmp/npm-shrinkwrap.json');
