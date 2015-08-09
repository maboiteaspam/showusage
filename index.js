#!/usr/bin/env node

var path = require('path')
var fs = require('fs')
var through2 = require('through2')
var glob = require('glob')
var byline = require('byline')
var mdUtils = require('md-stream-utils')
var resumer = require('resumer')
var exec = require('child_process').exec

var pkgToRead = process.argv[2] || 'showusage'
var section = process.argv[3] || '\\s+Usage'
var global = !fs.existsSync(path.join(pkgToRead, 'package.json'))
  && !fs.existsSync(path.join('.', 'node_modules', pkgToRead))

if (global) {
  npmPkgDir(pkgToRead, function(err, npmPkgHome){
    if (err) return console.error(err)
    showREADMESection (npmPkgHome, pkgToRead, section)
  })
} else {
  showREADMESection (process.cwd(), pkgToRead, section)
}

function showREADMESection (npmPkgHome, pkgToRead, section) {

  var data = {readme: ''}
  var basePath = ''
  if (fs.existsSync(path.join(npmPkgHome, 'node_modules', pkgToRead, 'package.json'))){
    data = require(path.join(npmPkgHome, 'node_modules', pkgToRead, 'package.json'))
    basePath = path.join(npmPkgHome, 'node_modules', pkgToRead)

  }else if (fs.existsSync(pkgToRead, 'package.json')){
    data = require(path.join(pkgToRead, 'package.json'))
    basePath = path.join(pkgToRead)

  }else{
    throw 'package not found'
  }

  var READMEContent

  if (!data.readme || data.readme==='ERROR: No README data found!') {
    var READMEfile = glob.sync('README**', {nodir: true, nocase: true, cwd: basePath})
    if (!READMEfile.length || !fs.existsSync(path.join(basePath, READMEfile[0]))) {
      return console.log('There is no README in this package')
    }
    READMEContent = fs.readFileSync(path.join(basePath, READMEfile[0]))
  } else {
    READMEContent = data.readme
  }

  var found = false

  resumer()
    .queue(READMEContent)
    .pipe(mdUtils.tokenizer())
    .pipe(mdUtils.byParapgraph())
    .pipe(mdUtils.filter({content: new RegExp(section)}))
    .pipe(mdUtils.cliColorize())
    .pipe(mdUtils.toString())
    .pipe(through2(function (chunk, enc, callback) {
      found = true
      this.push(chunk)
      callback()
    }))
    .pipe(process.stdout)

  process.on('beforeExit', function() {
    if (!found) console.error('This README does not have such section ' + section)
  });
}

function npmPkgDir (pkgToRead, then) {
  exec('npm ls ' + pkgToRead + ' -g --depth=1', function (err, stdout) {
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
