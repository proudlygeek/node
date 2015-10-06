#!/usr/bin/env node

var fs            = require('fs'),
    path          = require('path'),
    util          = require('util'),
    async         = require('async'),
    crypto        = require('crypto'),
    cheerio       = require('cheerio'),
    algoliasearch = require('algoliasearch');


var client = algoliasearch("E5KERA8ZVY", "db12729f373c2336179c6da1126f4531"),
    index  = client.initIndex('NodeJSDoc_dev');

var moduleAlias = {
  'about_this_documentation': 'documentation',
  'file_system': 'fs',
  'global_objects': 'globals',
  'class_buffer': 'buffer',
  'query_string': 'querystring',
  'string_decoder': 'stringdecoder',
  'tls_ssl': 'tls',
  'udp_datagram_sockets':'dgram',
  'executing_javascript': 'vm'
};

var propertyAlias = {
  'modules': 'module',
  'child_process': 'child',
  'cluster': 'cluster',
  'http': 'http_response'
};

function chunk(arr, chunkSize) {
  var i, j, 
      results = [], 
      chunkSize = chunkSize || 5000;

  for (i = 0,j = arr.length; i < j; i += chunkSize) {
    results.push(arr.slice(i, i + chunkSize));
  }

  return results;
}

function markdownName(text) {
  return text.match(/doc\/api\/(.+)\.markdown/)[1];
}

function generateObjectID(prefix, text) {
  return prefix + '_' + crypto.createHash('md5')
    .update(text)
    .digest('hex');
}

function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '_')           // Replace spaces with _
    .replace(/[\(\)]+/g, '_')       // Replace parentheses with _
    .replace(/[^\w\_]+/g, '_')       // Remove all non-word chars
    .replace(/\_\_+/g, '_')         // Replace multiple - with single _
    .replace(/^_+/, '')             // Trim - from start of text
    .replace(/_+$/, '');            // Trim - from end of text
}

function removeCodeBlocks(text) {
  var $ = cheerio.load(text);
  $('pre').remove();
  $('code').remove();
  return $.html();
}

function generateLink(module, link) {
  return [ 
    module, '.html#', 
    module, '_',  link 
  ].join('');
}

function generateBreadcrumb(hierarchy) {

  if (hierarchy.length === 0) return false;

  var $ = cheerio.load('<span></span>')

  return hierarchy.map(function(h) {
    $('span')
      .addClass('type--left')
      .addClass('type--' + h.type)
      .attr('data-href', h.link)
      .html(h.textValue);

    return $.html();
  }).join('<span class="sep">&gt;</span>');
}

function fold(arr, acc, importance, docName, hierarchy) {
  for (var i in arr) {
    for (var prop in arr[i]) {
      var current = arr[i][prop];

      // Don't index function parameters
      if (typeof current === 'object' && current.textRaw) {
        if (current.type === 'Array'  || 
            current.type === 'String' ||
            current.type === 'Number' ||
            current.type === 'Boolean'||
            current.type === 'example') continue;

    if ((current.type === 'var' || 
         current.type === 'method'
        ) && hierarchy.length === 0) continue;

        var textValue   = current.textRaw,
            link        = slugify(textValue),
            type        = current.type || 'properties',
            description = (current.desc) 
              ? removeCodeBlocks(current.desc) 
              : undefined;

        var currentHierarchy = hierarchy.concat({ 
          textValue: textValue, 
          type: type
        });

        var slugModule = (type === 'module' && hierarchy.length === 0)
          ? slugify(textValue)
          : slugify(currentHierarchy[0].textValue);

        var module = moduleAlias[slugModule] || slugModule;
        
        var obj = {
          type: type,
          textValue: textValue,
          description: description, 
          importance: importance
        };

        obj.module = module;
        obj.objectID = generateObjectID(link, textValue),
        obj.isStable = (current.stability !== 0);
        obj.isModule = (type === 'module'); 
        obj.link = generateLink(obj.module, link);

        currentHierarchy[currentHierarchy.length - 1].link = obj.link;

        obj.breadcrumb = generateBreadcrumb(hierarchy);
        obj.hierarchy = hierarchy;

        acc.push(obj);

        fold(current, acc, importance + 1, docName, currentHierarchy);
      }
    }
  }

  return acc;
}

function indexPrint(res, key, done) {
  console.log(prettify(res));
}

function indexChunk(obj, key, done) {
  console.log(util.format('  [#%d] => %d indexes', key + 1, obj.length));
  index.saveObjects(obj);
  done();
}

function readAllJson(err, data) {
  if (err) {
    throw err;
  }

  var object  = JSON.parse(data), 
      indexes = chunk(fold(object, [], 0, markdownName(object.source), []), 5000, null);

  if (process.argv.length > 1 && process.argv[2] == '--debug') {
    async.forEachOf(indexes, indexPrint, done);
  } else {
    console.log(util.format('Indexing %s chunk(s)', indexes.length));
    async.forEachOf(indexes, indexChunk, done);
  }
}

function prettify(json) {
  return JSON.stringify(json, null, 2);
}

function done(err) {
  if (err) {
     throw err;
  }

  console.log('\nIndex sync completed!');
}

function help(args) {
  var scriptName = args[1].split('/').pop();
 
  return [
    '',
    'Usage:',
    util.format('    %s [--debug]', scriptName),
    util.format('    %s -h | --help', scriptName),
    util.format('Options: \n    %s [--debug]', scriptName),
    ''
  ].join('\n');
}

if (process.argv.length > 1 && 
      (process.argv[2] === '-h' || 
       process.argv[2] === '--help')) {
  console.log(help(process.argv));
  return;
} 

fs.readFile(path.join(__dirname, '../../out/doc/api', 'all.json'), readAllJson);