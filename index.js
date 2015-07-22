#!/usr/bin/env node

var path = require('path')
var fs = require('fs')
var byline = require('byline')
var mdUtils = require('md-stream-utils')
var resumer = require('resumer')
var spawn = require('child_process').spawn

var pkgToRead = process.argv[2] || 'showusage'
var section = process.argv[3] || '\\s+Usage'

var npmHasFound = false
var npmError = false
var npmLineIndex = 0
var npmPkgHome = false

var npm = spawn('npm', ['ls', pkgToRead, '-g', '--depth=1'])

npm.on('error', function(e){
  npmError = e
})

byline(npm.stdout).on('data', function(d){
  d = ''+d
  if( npmLineIndex === 0 ){
    npmPkgHome = d
  } else if (d.match(/\(empty\)/)) {
    npmHasFound = false
  } else {
    npmHasFound = true
  }
  npmLineIndex++;
})

npm.on('close', function(){
  if (npmError) {
    console.error('NPM got error')
    console.error(npmError)
  }
  if (!npmHasFound) {
    return console.error('There is no such package: '+pkgToRead)
  }
  if (fs.existsSync(npmPkgHome) === false) {
    return console.error('There is no such directory: '+npmPkgHome)
  }
  var data = require( path.join(npmPkgHome, 'node_modules', pkgToRead, 'package.json'))
  if (!data.readme) {
    console.error('There is no README in this package')

  } else {
    resumer()
      .queue(data.readme)
      .pipe(mdUtils.tokenizer())
      .pipe(mdUtils.byParapgraph())
      .pipe(mdUtils.filter({content: new RegExp(section)}))
      .pipe(mdUtils.cliColorize())
      .pipe(mdUtils.toString())
      .pipe(process.stdout)
  }
})
