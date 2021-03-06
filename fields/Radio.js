"use strict";

// @IMPORTS
const Application = require("neat-base").Application;
const Tools = require("neat-base").Tools;
const Promise = require("bluebird");
const Field = require("../lib/Field.js");

module.exports = class Radio extends Field {

    /**
     *
     */
    init() {
        this.options = [];

        let options = this.config.options || [];

        if (options instanceof Object) {

            let opts = [];
            if (options instanceof Array) {
                for (let key in options) {
                    opts.push({
                        label: options[key],
                        value: options[key]
                    });
                }
            } else {
                for (let key in options) {
                    opts.push({
                        label: options[key],
                        value: key
                    });
                }
            }
            this.options = opts;
        } else {
            this.options = options;
        }
    }

    hasLazyOptions() {
        return typeof this.options.then == 'function';
    }

    loadSchema(defaultSchema) {
        return new Promise((resolve, reject) => {
            if (this.hasLazyOptions()) {
                this.options.then((result) => {
                    let options = {};

                    if (result instanceof Array) {
                        for (let i = 0; i < result.length; i++) {
                            let val = result[i];
                            options[val] = val;
                        }
                    }
                    else {
                        options = result;
                    }

                    defaultSchema.options = options;
                    return resolve(defaultSchema);
                });
            }
            else {
                defaultSchema.options = this.options;
                return resolve(defaultSchema);
            }
        });
    }

    /**
     *
     * @param val
     */
    setValue(val) {
        this.value = val;
        this.displayValue = this.options[val];
        this.valueSet = true;
    }

}