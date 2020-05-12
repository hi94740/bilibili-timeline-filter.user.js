// ==UserScript==
// @name b站时间线筛选
// @namespace hi94740
// @author hi94740
// @version 1.1.2
// @license MIT
// @description 这个脚本能帮你通过关注分组筛选b站时间线上的动态
// @include https://t.bilibili.com/*
// @run-at document-idle
// @noframes
// @grant unsafeWindow
// @grant GM.getResourceUrl
// @require https://cdn.jsdelivr.net/npm/vue/dist/vue.min.js
// @require https://cdn.jsdelivr.net/npm/vant@2.4/lib/vant.min.js
// @resource css https://cdn.jsdelivr.net/npm/vant@2.4/lib/index.css
// ==/UserScript==

var $ = unsafeWindow.jQuery

var vm
var tagged
var selectedTag
var cardObserver
var tabObserver

const filterDynamicWithTag = function(selection) {
  cardObserver.disconnect()
  if (selection == "shamiko"){
    clearFilters()
    autoPadding()
  } else {
    selectedTag = tagged[selection]
    console.log(selectedTag)
    new Promise(res => {
      let siid = setInterval(function () {
        if ($(".card").length > 0) {
          clearInterval(siid)
          res()
        }
      })
    }).then(function() {
      clearFilters()
      filterWorker()
      cardObserver.observe($(".card").parent()[0],{childList:true,subtree:true})
    })
  }
}

function filterWorker() {
  $(".card").toArray().forEach(c => {
    let href = $(c).children()[0].href
    if (href) {
      if (href.startsWith("https://space.bilibili.com/")) {
        if (!(selectedTag.list.some(up => up.mid == href.replace("https://space.bilibili.com/","").replace("/dynamic","")))) $(c)[0].hidden = true
      }
      if (href.startsWith("https://bangumi.bilibili.com/")) $(c)[0].hidden = true
    }
  })
  loadMoreDynamics()
  autoPadding()
}

function loadMoreDynamics() {
  if ($(window).height()/($(document).height() - $(document).scrollTop()) > 0.2) {
    $(".load-more").click()
    setTimeout(loadMoreDynamics,100)
  } else {
    if ($(".skeleton").length > 0) {
      if (($($(".skeleton")[0]).offset().top - $(document).scrollTop()) < ($(window).height() + 1000)) {
        forceLoad()
        setTimeout(loadMoreDynamics,100)
      }
    }
  }
}

function forceLoad() {
  let currentY = $(document).scrollTop()
  $(document).scrollTop($(document).height())
  $(document).scrollTop(currentY)
}

function clearFilters() {
  $(".card").toArray().forEach(c => c.hidden = false)
}

function autoPadding() {
  $("#filterUI").css("padding",($(".card")[0] && $(".new-notice-bar").length == 0) ? ($(".card")[0].hidden ? "0px 0px 0px 0px" : "0px 0px 8px 0px") : "0px 0px 8px 0px")
}

function isBangumiTimeline() {
  if ($(".selected").text().includes("番") || $(".selected").text().includes("剧")) {
    $("#filterUI")[0].hidden = true
    cardObserver.disconnect()
    clearFilters()
  } else {
    $("#filterUI")[0].hidden = false
    if (selectedTag) filterDynamicWithTag(vm.activeName)
  }
}


const range = (start, stop, step) => Array.from({ length: (stop - start) / step + 1}, (_, i) => start + (i * step))

function ajaxWithCredentials(url) {
  return new Promise((res,rej) => {
    $.ajax({
      url:url,
      xhrFields: {
        withCredentials: true
      },
      success:res,
      error:rej
    })
  })
}

function fetchTags(requestWithCredentials) {
  let tags = {}
  return requestWithCredentials("https://api.live.bilibili.com/User/getUserInfo")
    .then(data => {
      let uid = data.data.uid
      console.log("uid: " + uid)
      let followingsRequests = requestWithCredentials("https://api.bilibili.com/x/relation/followings?vmid=" + uid + "&pn=1&ps=50")
        .then(data => {
          let gf = range(2,Math.ceil(data.data.total/50),1)
            .map(i => {
              return requestWithCredentials("https://api.bilibili.com/x/relation/followings?vmid=" + uid + "&pn=" + i + "&ps=50")
            })
          gf.unshift(Promise.resolve(data))
          return gf
        })
      return requestWithCredentials("https://api.bilibili.com/x/relation/tags?vmid=" + uid)
        .then(data => {
          let tagsList = data.data
          tagsList.map(tag => {
            tag.list = []
            return tag
          }).forEach(tag => tags[tag.tagid] = tag)
          return {
            tags:tagsList,
            tagged:followingsRequests.then(gf => {
              return Promise.all(gf.map(request => {
                return request.then(data => {
                  let followings = data.data.list
                  followings.forEach(f => {
                    if (f.tag) {
                      f.tag.forEach(t => {
                        let tagCount = 0
                        if (tags[t]) {
                          tags[t].list.push(f)
                          tagCount++
                        } else console.log("迷之tag：" + t)
                        if (tagCount == 0) tags[0].list.push(f)
                      })
                    } else {
                      tags[0].list.push(f)
                    }
                  })
                })
              })).then(() => tags)
            })
          }
        })
    })
}



Promise.all([
  fetchTags(ajaxWithCredentials),
  GM.getResourceUrl("css")
    .then(u => $("head").append('<link rel="stylesheet" href="' + u + '">')),
  new Promise(res => {
    cardObserver = new MutationObserver(filterWorker)
    tabObserver = new MutationObserver(isBangumiTimeline)
    Vue.use(vant.Tab)
    Vue.use(vant.Tabs)
    let siid = setInterval(function () {
      if ($(".tab-bar").length == 1) {
        clearInterval(siid)
        res()
      }
    })
  }).then(function() {
    $(".tab-bar").after('<div id="filterUI"><div id="shamiko"></div></div>')
    $("#filterUI")[0].hidden = true
    autoPadding()
    tabObserver.observe($(".tab-bar")[0],{childList:true,subtree:true,attributes:true})
  })
]).then(data => {
  let tagOptions = data[0].tags.filter(t => t.count != 0)
  tagOptions.unshift({tagid:"shamiko",name:"全部"})
  let loadCompleted = false
  vm = new Vue({
    el:"#shamiko",
    template: '<van-tabs v-model="activeName" line-height="2px" color="#00a1d6" title-inactive-color="#99a2aa" swipe-threshold="10" @click="onClick"><van-tab v-for="tag in tags" :title="tag.name" :name="tag.tagid"></van-tab></van-tabs>',
    data:{
      activeName:"shamiko",
      tags:tagOptions
    },
    methods:{onClick:s => {
      if (loadCompleted) setTimeout(filterDynamicWithTag,300,s)
      else {
        setTimeout(() => {vm.activeName = "shamiko"},100)
        vant.Toast.fail("分组名单尚未加载完成，请稍后再试！")
      }
    }}
  })
  $(".van-tabs").children()[0].style["border-radius"] = "4px"
  isBangumiTimeline()
  data[0].tagged.then(data => {
    tagged = data
    loadCompleted = true
  })
}).catch(err => {
  console.error(err)
  alert("【b站时间线筛选】脚本出错了！\n请查看控制台以获取错误信息")
})