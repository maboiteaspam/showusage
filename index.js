#!/usr/bin/env node

var path = require('path')
var fs = require('fs')
var through2 = require('through2')
var glob = require('glob')
var byline = require('byline')
var mdUtils = require('md-stream-utils')
var inquirer = require("inquirer");
var exec = require('child_process').exec

var pkgToRead = process.argv[2] || 'showusage'
var sectionToFind = process.argv[3] || '\\s+Usage'
var global = !fs.existsSync(path.join(pkgToRead, 'package.json'))
  && !fs.existsSync(path.join('.', 'node_modules', pkgToRead, 'package.json'))

if (global) {
  npmPkgDir(pkgToRead, function(err, npmPkgHome){
    if (err) return console.error('This package \'' + pkgToRead + '\' is not found.')
    showREADMESection (npmPkgHome, pkgToRead, sectionToFind)
  })
} else {
  showREADMESection (process.cwd(), pkgToRead, sectionToFind)
}

function showREADMESection (npmPkgHome, pkgToRead, sectionToFind) {

  var pkgPath = findPackagePath(npmPkgHome, pkgToRead)
  if (!pkgPath) {
    return console.error('Can\'t find package \''+pkgToRead+'\'')
  }
  var READMEContent = getREADMEContent(pkgPath)
  if (!READMEContent) {
    return console.error('Can\'t find README file for \''+pkgToRead+'\'')
  }

  getOneParagrah(READMEContent, sectionToFind, function (err) {
    if (err) {
      return getAllHeadings(READMEContent, function (headings) {
        var suggestions = ['All the content']
        headings.forEach(function (head) {
          suggestions.push(head.content)
        })
        suggestions.push(new inquirer.Separator())
        var message = ''
          + err + '\n'
          + 'Would you like to read an alternative section ?' + ''
        suggestAlternativeReadings(message, suggestions, function (answer) {
          if (answer.match(/^All the content$/)) {
            var stream = toCharacter();
            stream.pipe(mdUtils.tokenizer())
              .pipe(mdUtils.cliColorize())
              .pipe(mdUtils.toString())
              .pipe(process.stdout);
            stream.write(READMEContent)
          } else {
            getOneParagrah(READMEContent, answer).pipe(process.stdout).resume()
          }
        })
      }).resume()
    }
  }).pipe(process.stdout).resume()
}

function findPackagePath (npmPkgHome, pkgToRead) {

  var basePath = false
  if (fs.existsSync(path.join(npmPkgHome, 'node_modules', pkgToRead, 'package.json'))){
    basePath = path.join(npmPkgHome, 'node_modules', pkgToRead)

  }else if (fs.existsSync(pkgToRead, 'package.json')){
    basePath = path.join(pkgToRead)

  }else{
    throw 'package not found'
  }

  return basePath
}

function getREADMEContent (npmPkgPath) {

  var READMEContent = false
  var packagePath = path.join(npmPkgPath, 'package.json')
  var data = require(packagePath) || {readme: ''}

  if (!data.readme || data.readme==='ERROR: No README data found!') {
    var READMEfile = glob.sync('README**', {nodir: true, nocase: true, cwd: npmPkgPath})
    if (READMEfile.length) {
      var READMEPath = path.join(npmPkgPath, READMEfile[0])
      if (fs.existsSync(READMEPath)) {
        READMEContent = fs.readFileSync(READMEPath)
      }
    }
  } else {
    READMEContent = data.readme
  }

  return READMEContent
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

function toCharacter () {
  return through2(function (chunk, enc, callback) {
    chunk = '' + chunk
    for(var i=0;i<chunk.length;i++) {
      this.push(chunk.substr(i, 1))
    }
    this.push( null );
    callback()
  })
}

function getOneParagrah(READMEContent, section, then){
  var paragraph = ''
  var stream = toCharacter();
  var tokenized = stream
    .pipe(mdUtils.tokenizer())
    .pipe(mdUtils.byParapgraph())
    .pipe(mdUtils.filter({content: new RegExp(section)}))
    .pipe(mdUtils.cliColorize())
    .pipe(mdUtils.toString())
    .pipe((function(){
      var index = 0
      return through2(function (chunk, enc, callback) {
        index++;
        if (then) paragraph+='' + chunk
        this.push(chunk)
        callback()
      }, function(callback){
        var err = !index
          ? 'This README does not have such section ' + section
          : null;
        if (then) then(err, paragraph)
        callback()
      })
    })())
  tokenized.pause()
  stream.write(READMEContent)
  return tokenized
}

function getAllHeadings(READMEContent, then){
  var headings = []
  var stream = toCharacter();
  var tokenized =
    stream.pipe(mdUtils.tokenizer())
    .pipe(mdUtils.byLine())
    .pipe(through2.obj(function (chunk, enc, callback) {
      if (chunk[0].type==='heading') {
        var str = {
          power: chunk[0].content.length,
          content: ''
        }
        chunk.forEach(function (c) {
          if (['text','whitespace'].indexOf(c.type)>-1) {
            str.content += c.content
          }
        })
        str.content = str.content.replace(/^\s+/, '')
        this.push(str)
      }
      callback()
    })).pipe(through2.obj(function (chunk, enc, callback) {
      headings.push(chunk)
      this.push(chunk)
      callback()
    }, function(callback){
      if (then) then(headings)
      callback()
    })).pause();
  stream.write(READMEContent)
  return tokenized
}

function suggestAlternativeReadings(message, suggestions, then){
  inquirer.prompt([{
      type: "list",
      name: "suggested",
      message: message,
      choices: suggestions
    }], function( answers ) {
    then(answers.suggested)
  });
}
