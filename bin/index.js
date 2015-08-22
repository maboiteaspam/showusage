#!/usr/bin/env node

var path = require('path')
var fs = require('fs')
var through2 = require('through2')
var glob = require('glob')
var byline = require('byline')
var mds = require('md-stream-utils')
var inquirer = require("inquirer");
var exec = require('child_process').exec

var showusage = require('../index.js')

var pkgToRead = process.argv[2] || 'showusage'
var sectionToFind = process.argv[3] || '\\s+Usage'

var showAll = process.argv.join(' ').match(/\s*-a|--all/)
if (showAll) sectionToFind = false

var global = !fs.existsSync(path.join(pkgToRead, 'package.json'))
  && !fs.existsSync(path.join('.', 'node_modules', pkgToRead, 'package.json'))

if (global) {
  npmPkgDir(pkgToRead, function(err, npmPkgHome){
    if (err) return console.error('This package \'' + pkgToRead + '\' is not found.')
    showusage(npmPkgHome, pkgToRead, sectionToFind)
  })
} else {
  showusage(process.cwd(), pkgToRead, sectionToFind)
}

function npmPkgDir (pkgToRead, then) {
  exec('npm ls ' + pkgToRead + ' -g --depth=0', function (err, stdout) {
    if (err) {
      return then(err)
    }

    var npmPkgHome = stdout.split('\n')[0]
    if (!fs.existsSync(npmPkgHome)) {
      return then('There is no such directory: '+npmPkgHome)
    }

    then(null, npmPkgHome)
  })
}