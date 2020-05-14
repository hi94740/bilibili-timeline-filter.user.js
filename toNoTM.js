const fs = require("fs")
const request = require("superagent")
const toString = require('stream-to-string')
const B64 = require('@hapi/b64')
const encoder = new B64.Encoder()

Promise.all([
  getRemoteResources(fs.readFileSync("./b站时间线筛选.user.js").toString()),
  request.get("https://cdn.jsdelivr.net/npm/jquery@3.5.1/dist/jquery.min.js")
]).then(data => fs.writeFileSync("./NoTM.js",data[1].body.toString() + "\n\n\n\n" + data[0].replace("\nvar $ = unsafeWindow.jQuery\n","")))

function getRemoteResources(script) {
  let resources = {}
  let infoBlock = script.split("\n// ==/UserScript==")[0].split("// ==UserScript==\n").pop().split("\n")
  return Promise.all(infoBlock.filter(l => l.startsWith("// @require ")).map(l => {
    let url = l.replace("// @require ","").trim()
    console.log("getting script: " + url)
    return request.get(url).then(res => res.body.toString())
  })).then(rs => {
    rs.push(script)
    return rs.join("\n\n\n\n")
  }).then(sip => {
    return Promise.all(infoBlock.filter(l => l.startsWith("// @resource ")).map(l => {
      let pair = l.replace("// @resource ","").split(" ").filter(p => p != "")
      let key = pair[0]
      let url = pair.pop()
      console.log("getting " + key + ": " + url)
      let resource = {}
      return Promise.all([
        request.head(url).then(res => resource.type = res.type),
        toString(request.get(url).pipe(encoder)).then(b => resource.base64 = b)
      ]).then(() => resources[key] = resource)
    })).then(() => {
      return "var GM = !function(){\n\
  var GM = {}\n\
  let resources = " + JSON.stringify(resources) + "\n\
  GM.getResourceUrl = key => Promise.resolve('data:' + resources[key].type +';base64,' + resources[key].base64)\n\
  return GM\n\
}()\n\n\n\n" + sip
    })
  })
}