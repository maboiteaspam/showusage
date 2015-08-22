# showusage

Show pretty printed `Usage` section of a node package.

If the `README` file does not contain such section,
 the program suggest a list of alternative readings.


## Installation
Run the following commands to download and install the application:

```sh
npm i showusage -g
```
Run the following commands to download and install the API:

```sh
npm i showusage --save
```

## Usage

**`showusage <NPM module> <README section>`**

* `NPM module` is the `name`, or `path` of the module within `local` or `global` to read.
* `README section` is the `name` or a `regexp` of the section's `heading`'s paragraph to extract.

## API

**`showusage(npmPkgHome, pkgToRead, sectionToFind)`**

* `npmPkgHome` string Path to the directory containing the `node_modules` folder to look into.
* `pkgToRead` string Name of the package `README` to parse.
* `sectionToFind` string The `name` or a `regexp` of the section's `heading`'s paragraph to extract.

__Most common usage example__
```js
var cliargs = require('cliargs');
var showusage = require('showusage')

var argsObj = cliargs.parse();

if(argsObj.help || argsObj.h){
  return showusage(path.join(__dirname, '..'), pkg.name, 'Usage')
}
```


## How to contribute

1. File an issue in the repository, using the bug tracker, describing the
   contribution you'd like to make. This will help us to get you started on the
   right foot.
2. Fork the project in your account and create a new branch:
   `your-great-feature`.
3. Commit your changes in that branch.
4. Open a pull request, and reference the initial issue in the pull request
   message.

## License
See the [LICENSE](./LICENSE) file.
