'use strict';

/**
 * main.js — Application entry point
 *
 * Loads the main application module from src/main/index.js.
 * Fallbacks to .jsc bytecode if .js is unavailable.
 */

const path = require('path');
const fs   = require('fs');

const jsEntry  = path.resolve(__dirname, 'src', 'main', 'index.js');
const jscEntry = path.resolve(__dirname, 'build-tmp', 'src', 'main', 'index.jsc');

if (fs.existsSync(jsEntry)) {
    require(jsEntry);
} else if (fs.existsSync(jscEntry)) {
    const bytenode = require('bytenode');
    require(jscEntry);
} else {
    require('./src/main/index');
}
