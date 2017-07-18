const http = require('http');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require('fs');
const path = require('path');
const extend = require('extend');
const slice = Array.prototype.slice;

const hostname = 'www.57mh.com';
const destdir = 'C:\\Users\\i311688\\Desktop\\MyTemp\\manga';
const agent = new http.Agent({
    keepAlive: true,
    maxSockets: 10,
    maxFreeSockets: 3
});

const getAllChapters = function(){
    return new Promise((resolve, reject) => {
        http.request({
            agent: agent,
            hostname: hostname,
            path: '/118/',
            method: 'GET',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
            }
        }, (rsp) => {
            rsp.setEncoding('utf8');
            // const file = fs.createWriteStream(path.resolve(destdir, './home.html'));
            // rsp.pipe(file);
            // file.on('finish', () => file.close());
            let domstring = [];
            rsp.on('data', (chunk) => {
                domstring.push(chunk);
            }).on('end', ()=>{
                console.log('read all');
                const dom = new JSDOM(domstring.join(''));
                let chpaterList = dom.window.document.querySelector('#chpater-list-1').querySelectorAll('a.status0');
                resolve(slice.call(chpaterList).map(a => ({path: a.getAttribute('href'), title: a.getAttribute('title')})));
            }).on('error', () => reject(arguments));
        }).end();
    });
};

const getPagesOfChapter = function(chapter){
    const pageRex = /'([^,]+)'\.split\('\|'\)/;
    return new Promise((resolve, reject) => {
        http.request({
            agent: agent,
            hostname: hostname,
            path: chapter.path,
            method: 'GET',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
            }
        }, (rsp) => {
            rsp.setEncoding('utf8');
            let domstring = [];
            rsp.on('data', (chunk) => {
                domstring.push(chunk);
            }).on('end', ()=>{
                const dom = new JSDOM(domstring.join(''));
                let pageArr = slice.call(dom.window.document.querySelectorAll('script')).filter(s => {
                    return pageRex.test(s.innerHTML);
                }).map(s => pageRex.exec(s.innerHTML)[1])[0].split('|');
                // http://images.720rs.com/manhuatuku/1992/2013122510530808.jpg
                let basepath = '/' + pageArr[2] + '/' + pageArr[0] + '/';
                let type = pageArr[1];
                pageArr.filter(p => {
                    try{
                        return !isNaN(p) && parseInt(p) > 201312251;
                    }catch(e){
                        return false
                    }
                }).forEach(p => {
                    let fileName = p + '.' + type;
                    http.request({
                        agent: agent,
                        hostname: hostname,
                        path: basepath + fileName,
                        method: 'GET',
                        headers: {
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
                        }
                    }, (rsp) => {
                        try{
                            fs.accessSync(path.resolve(destdir, './', chapter.path));
                        }catch(e){
                            fs.mkdir(path.resolve(destdir, './', chapter.path));
                        }
                        let file = fs.createWriteStream(path.resolve(destdir, ('./' + chapter.path + '/' + fileName)));
                        rsp.on('error', err => {
                            console.error('There was an error reading the file!', err);
                        });
                        file.on('error', err => {
                            console.error('There was an error reading the file!', err);
                        });
                        rsp.pipe(file);
                        file.on('finish', () => {
                            file.close();
                            console.log(file.path + ' done!');
                        });

                    }).end();
                })
            }).on('error', () => reject(arguments));
        }).end();
    });
};

getAllChapters().then(d => getPagesOfChapter(d[0]))