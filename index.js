#!/usr/bin/env node

var path = require('path')
var fs = require('fs')
var through2 = require('through2')
var glob = require('glob')
var byline = require('byline')
var mds = require('md-stream-utils')
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

  process.stdin.resume();

  getParsedContent(READMEContent, function(err, parsed){
    var stream = getOneParagrah(parsed, sectionToFind);
    stream.on('notfound', function(err){
      getAllHeadings(parsed, function (headings) {
        var suggestions = ['All the content']
        headings.forEach(function (head) {
          suggestions.push(head)
        })
        suggestions.push(new inquirer.Separator())
        var message = ''
          + err + '\n'
          + 'Would you like to read an alternative section ?' + ''
        suggestAlternativeReadings(message, suggestions, function (answer) {
          var pumpable = new mds.PausableStream();
          pumpable.pause();
          if (answer.match(/^All the content$/)) {
            var stream = through2.obj();
            stream
              .pipe(pumpable.stream)
              .pipe(mds.format())
              .pipe(mds.colorize())
              .pipe(mds.less(pumpable))
              .pipe(mds.flattenToString(mds.resolveColors.transform))
              .pipe(process.stdout);
            stream.write(parsed)
          } else {
            getOneParagrah(parsed, answer)
              .pipe(pumpable.stream)
              .pipe(mds.format())
              .pipe(mds.colorize())
              .pipe(mds.less(pumpable))
              .pipe(mds.flattenToString(mds.resolveColors.transform))
              .pipe(process.stdout)
          }
        })
      });
    })
    var pumpable = new mds.PausableStream();
    pumpable.pause();
    stream
      .pipe(pumpable.stream)
      .pipe(mds.format())
      .pipe(mds.colorize())
      .pipe(mds.less(pumpable))
      .pipe(mds.flattenToString(mds.resolveColors.transform))
      .pipe(process.stdout);
  }).resume()

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
  var packagePath = path.join(npmPkgPath, 'package.json');
  (npmPkgPath==='.') && (packagePath = './package.json')
  var data = JSON.parse(fs.readFileSync(packagePath)) || {readme: ''}

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

function getOneParagrah(parsed, section){
  var hasFoundH = false
  var hasFoundP = false
  var stream = through2.obj();
  process.nextTick(function(){
    stream.write(parsed)
    stream.end();
  })
  return stream
    .pipe(mds.byParagraph())
    .pipe(through2.obj(function(c,_,cb){
      if (!hasFoundH
        && c.length()
        && c.first().type.match(/heading/)
        && c.match(section)) {
        hasFoundH = true
        this.push(c)
      } else if (hasFoundH && !hasFoundP) {
        hasFoundP = true
        this.push(c)
      }
      cb()
    }))
    .pipe((function(){
      var index = 0
      return through2.obj(function (chunk, enc, callback) {
        index++
        callback(null, chunk)
      }, function(callback){
        if (!index)
          this.emit('notfound', 'This README does not have such section ' + section)
        callback()
      })
    })());
}

function getAllHeadings(parsed, then){
  var headings = []
  var stream = through2.obj();
  process.nextTick(function(){
    stream.write(parsed);
    stream.end();
  });
  return stream
    .pipe(mds.extractBlock(/heading/, mds.filter({type: /.+/})))
    .pipe(mds.extractBlock(/heading/, mds.removeFrontspace()))
    .pipe(mds.extractBlock(/heading/, function(buf){
      headings.push(buf.filterType('text').toString())
    }))
    .pipe(through2.obj(function (chunk, enc, callback) {
      callback()
    }, function(callback){
      if (then) then(headings)
      callback()
    }));
}

function getParsedContent(READMEContent, then){
  var parsed = new mds.TokenString()
  var stream = toCharacter();
  var tokenized =
    stream
      .pipe(mds.toTokenString())
      .pipe(mds.tokenize())
      .pipe(through2.obj(function(c,_,cb){
        parsed.concat(c.splice(0))
        cb()
      }))
      .on('end', function(){
        if (then) then(null, parsed)
      }).pause();
  process.nextTick(function () {
    stream.write(READMEContent)
  })
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
