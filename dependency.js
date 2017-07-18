const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const path = require('path');
const slice = Array.prototype.slice;
const https = require('https');
const http = require('http');
// const request = require('request');


process.env.HTTPS_PROXY = {
    hostname: '127.0.0.1',
    port: 8888
}
process.env.HTTP_PROXY = {
    hostname: '127.0.0.1',
    port: 8888
}

const when = function(){
    return new Promise((resolve, reject) => {
        let datas = [];
        let errors = [];
        let count = arguments.length;
        slice.call(arguments).forEach((promise, idx) => {
            promise.then(d => {
               datas[idx] = d;
               count--;
               if(count == 0){
                  resolve(datas);
               }
            }, e => {
                errors[idx] = e;
                count--;
                if(count == 0){
                  reject(errors);
                }
            })
        });
    });
};

const readFile = function(relativepath){
    return new Promise((resolve, reject) => {
        fs.readFile(path.resolve(__dirname, relativepath), 'utf8', (err, data) => {
            if(err){
                reject(err);
                return;
            }
            resolve(data.split(/\r?\n/ig));
        });
    });
};

const getJarProfile = function(jars){
    const agent = new http.Agent({
        keepAlive: true,
        maxSockets: 10,
        maxFreeSockets: 3
    });
    let count = jars.length;
    let profile = [];
    jars.forEach(jar => {
        console.log('start to get profile of: ' + '/artifact/' + jar.split(':').join('/'));
        http.request({
            agent: agent,
            hostname: 'mvnrepository.com',
            path: '/artifact/' + jar.split(':').join('/'),
            method: 'GET',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
            }
        }, (rsp) => {
            console.log(rsp.statusCode);
            if(rsp.statusCode >= 400){
                console.log('error https response: ' + '/artifact/' + jar.split(':').join('/'));
                profile.push({
                    name: jar,
                    notfound: true
                });
                if(profile.length == count){
                    console.log(profile.map(p => {
                        return p.notfound? (p.name + ' => not fount') : (p.name + ' => ' + p.license + ' => ' + p.homepage);
                    }).join('\r\n'));
                }
                return;
            }
            rsp.setEncoding('utf8');
            // const file = fs.createWriteStream(path.resolve(destdir, './home.html'));
            // rsp.pipe(file);
            // file.on('finish', () => file.close());
            let domstring = [];
            rsp.on('data', (chunk) => {
                domstring.push(chunk);
            }).on('end', ()=>{
                console.log('done: ' + '/artifact/' + jar.split(':').join('/'));
                const dom = new JSDOM(domstring.join(''));
                let _profile = {
                    name: jar
                };
                dom.window.document.querySelector('#maincontent>.grid').querySelectorAll('tr').forEach(tr => {
                    let title = tr.querySelector('th').innerHTML;
                    if('License' == title){
                        _profile.license = tr.querySelector('span').innerHTML;
                    }else if('HomePage' == title){
                        _profile.homepage = tr.querySelector('a').getAttribute('href');
                    }
                });
                profile.push(_profile);
                if(profile.length == count){
                    console.log(profile.map(p => {
                        return p.notfound? (p.name + ' => not fount') : (p.name + ' => ' + p.license + ' => ' + p.homepage);
                    }).join('\r\n'));
                }
            }).on('error', (err) => reject(err));
        }).end();
    });
};

when(readFile('./jars_in_dependency.txt'), readFile('./jars_in_folder.txt')).then((data) => {
    let jarsInDependency = data[0];
    let jarsInFolder = data[1];
    jarsInDependency = jarsInDependency.filter(jar => {
        return jarsInFolder.indexOf(jar.split(':').slice(1).join('-') + '.jar') >= 0;
    });
    if(jarsInDependency.length != jarsInFolder.length){
        console.error('dependencies not coincident');
        return;
    }
    getJarProfile(jarsInDependency);
})

// var targetOptions = {
//         method: 'GET',
//         url: 'https://mvnrepository.com/artifact/com.sun.xml.bind/jaxb-impl/2.2.7',
//         timeout: 8000,
//         encoding: null,
//         proxy: 'http://localhost:8888'
//     };
// request(targetOptions, function (error, response, body) {
//     try {
//         if (error) throw error;
//         body = body.toString();
//         console.log(body);
//     } catch (e) {
//         // console.error(e);
//     }
// }).end();
