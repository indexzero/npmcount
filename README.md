# npmcount

Silly program that counts number of npm packages from one or more users.

## Installation

### Installing npm (node package manager)
``` bash
  $ curl http://npmjs.org/install.sh | sh
```

### Installing npmcount
``` bash
  $ [sudo] npm install npmcount -g
```

## Usage

``` bash
  $ npmcount tjholowaychuk substack isaacs dominictarr marak Tim-Smart felixge indexzero
  info:   Loading npm
  info:   Searching npm
  data:   name                     description                                   maintainers                           
  data:   abbrev                   Like ruby's abbrev module, but in js          =isaacs                               
  data:   amd                      Async Module Definition - module loader/...   =dominictarr                          
  data:   ap                       Currying in javascript. Like .bind() wit...   =substack                             
  data:   api-easy                 Fluent (i.e. chainable) syntax for gener...   =indexzero                            
  data:   asciimo                  create awesome ascii art with javascript...   =marak                                
  data:   assertions               loads of useful assert functions in one ...   =dominictarr                          
  data:   asset                    Asset manager                                 =tjholowaychuk                        
  data:   async-chain              No description                                =dominictarr                          
  (...)                           
  info:   Done listing all npm packages for: tjholowaychuk substack isaacs dominictarr marak Tim-Smart felixge indexzero
  info:   Total packages: 258
```

#### Author: [Charlie Robbins](http://nodejitsu.com)
#### License: MIT