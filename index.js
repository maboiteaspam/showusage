#!/usr/bin/env node

var pkgToRead = process.argv[2] || 'showusage'
var section = new RegExp(process.argv[3]) || 'usage'
var npm = require('npm')
var path = require('path')
var mdUtils = require('md-stream-utils')
var resumer = require('resumer')

npm.load({global: true, depth: 1},function(err, npm) {
  npm.commands.ls([pkgToRead], true, function(err, data) {
    data = data.dependencies[pkgToRead];
    if (!data){
      console.error('There is no such package: '+pkgToRead)
    }else if (data.readme) {
      resumer()
        .queue(data.readme)
        .pipe(mdUtils.tokenizer())
        .pipe(mdUtils.byParapgraph())
        .pipe(mdUtils.filter({content: /\s+Usage/}))
        .pipe(mdUtils.cliColorize())
        .pipe(mdUtils.toString())
        .pipe(process.stdout)

    } else {
      console.error('There is no README in this package')
    }
  });
});
