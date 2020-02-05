// ==UserScript==
// @name b站时间线筛选
// @namespace hi94740
// @author hi94740
// @version 0.1.0
// @license MIT
// @description 这个脚本能帮你通过关注分组筛选b站时间线上的动态
// @include https://t.bilibili.com/*
// @run-at document-idle
// @noframes
// ==/UserScript==

var $ = unsafeWindow.jQuery

var tagged
var selectedTag
var observer = new MutationObserver(filterWorker)

const filterDynamicWithTag = function() {
  observer.disconnect()
  let selection = $("#selectUpTag").val()
  if (selection == "shamiko"){
    clearFilters()
    UIPadding()
  } else {
    selectedTag = tagged.find(t => t.tagid == selection)
    console.log(selectedTag)
    observer.observe($("#app > div > div.home-page.f-clear > div.home-container > div > div.center-panel.f-left > div.card-list > div > div.content")[0],{childList:true,subtree:true})
    clearFilters()
    filterWorker()
  }
}

function filterWorker() {
  Array.from($(".card")).forEach(c => {
    let href = $(c).children()[0].href
    if (href) {
      if (href.startsWith("https://space.bilibili.com/")) {
        if (!(selectedTag.list.some(up => up.mid == href.replace("https://space.bilibili.com/","").replace("/dynamic","")))) $(c)[0].hidden = true
      }
      if (href.startsWith("https://bangumi.bilibili.com/")) $(c)[0].hidden = true
    }
  })
  setTimeout(loadMoreDynamics,10)
  setTimeout(loadMoreDynamics,100)
  UIPadding()
}

function loadMoreDynamics() {
  let currentY = $(document).scrollTop()
  $(document).scrollTop($(document).height())
  $(document).scrollTop(currentY)
}

function clearFilters() {
  Array.from($(".card")).forEach(c => c.hidden = false)
}

function UIPadding() {
  $("#filterUI").css("padding",$(".card")[0] ? ($(".card")[0].hidden ? "0px 0px 0px 0px" : "0px 0px 8px 0px") : "0px 0px 8px 0px")
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
  return requestWithCredentials("https://api.live.bilibili.com/User/getUserInfo").then(data => {
      let uid = data.data.uid
      console.log(uid)
      return Promise.all([requestWithCredentials("https://api.bilibili.com/x/relation/followings?vmid=" + uid + "&pn=1&ps=50").then(data => {
        let gf = range(2,Math.ceil(data.data.total/50),1).map(i => {
          return requestWithCredentials("https://api.bilibili.com/x/relation/followings?vmid=" + uid + "&pn=" + i + "&ps=50")
        })
        gf.unshift(data)
        return Promise.all(gf)
      }),requestWithCredentials("https://api.bilibili.com/x/relation/tags?vmid=" + uid)])
    }).then(data => {
      let followings = data[0].map(p => p.data.list).flat()
      let tags = data[1].data
      return tags.map(tag => {
        if (tag.tagid == 0) {
          tag.list = followings.filter(f => {
            return f.tag == null
          })
        } else {
          tag.list = followings.filter(f => {
            if (f.tag) return f.tag.includes(tag.tagid)
            return false
          })
        }
        return tag
      })
    })
}



Promise.all([new Promise(res => {
  setInterval(function () {
    if ($(".tab-bar").length == 1) res()
  })
}).then(function() {$(".tab-bar").after('<div id="filterUI">正在加载分组……</div>');UIPadding()}),fetchTags(ajaxWithCredentials)]).then(data => {
  $("#filterUI").html('<select id="selectUpTag"></select>')
  tagged = data[1]
  console.log(tagged)
  let tagOptions = tagged.filter(t => t.count != 0)
  tagOptions.unshift({tagid:"shamiko",name:"无筛选"})
  $("#selectUpTag").append(tagOptions.map(t => '<option value="' + t.tagid + '">' + t.name + '</option>').join()).val("shamiko").change(filterDynamicWithTag)
})