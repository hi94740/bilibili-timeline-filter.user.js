// ==UserScript==
// @name b站时间线筛选
// @namespace hi94740
// @author hi94740
// @version 0.0.3
// @license MIT
// @description 这个脚本能帮你通过关注分组筛选b站时间线上的动态
// @include https://t.bilibili.com/*
// @run-at document-idle
// @noframes
// ==/UserScript==

function loadMoreDynamics() {
  let currentY = $(document).scrollTop()
  $(document).scrollTop($(document).height())
  $(document).scrollTop(currentY)
}

//function refreshDynamics() {}

unsafeWindow.filterDynamicWithTag = function() {
  let selectedTag = tagged.find(t => t.tagid == $("#selectUpTag").val())
  console.log(selectedTag)
  $("#filterUI").html("已筛选分组：" + selectedTag.name)
  setInterval(function() {
    Array.from($(".card")).forEach(c => {
      let href = $(c).children()[0].href
      if (href) {
        if (href.startsWith("https://space.bilibili.com/")) {
          if (!(selectedTag.list.some(up => up.mid == href.replace("https://space.bilibili.com/","").replace("/dynamic","")))) $(c).remove()
        }
        if (href.startsWith("https://bangumi.bilibili.com/")) $(c).remove()
      }
    })
    loadMoreDynamics()
  },100)
}

var $ = unsafeWindow.jQuery

var tagged

const range = (start, stop, step) => Array.from({ length: (stop - start) / step + 1}, (_, i) => start + (i * step))

function ajaxWithCredential(url) {
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

function fetchTags() {
  return ajaxWithCredential("https://api.live.bilibili.com/User/getUserInfo").then(data => {
      let uid = data.data.uid
      console.log(uid)
      return Promise.all([ajaxWithCredential("https://api.bilibili.com/x/relation/followings?vmid=" + uid + "&pn=1&ps=50").then(data => {
        let gf = range(2,Math.ceil(data.data.total/50),1).map(i => {
          return ajaxWithCredential("https://api.bilibili.com/x/relation/followings?vmid=" + uid + "&pn=" + i + "&ps=50")
        })
        gf.unshift(data)
        return Promise.all(gf)
      }),ajaxWithCredential("https://api.bilibili.com/x/relation/tags?vmid=" + uid)])
    }).then(data => {
      let followings = data[0].map(p => p.data.list).flat()
      let tags = data[1].data
      tagged = tags.filter(tag => tag.count != 0).map(tag => {
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
      console.log(tagged)
    })
}

Promise.all([new Promise(res => {
  setInterval(function () {
    if ($(".tab-bar").length == 1) res()
  })
}).then(function() {$(".tab-bar").after('<div id="filterUI">正在加载分组……</div>')}),fetchTags()]).then(function() {
  $("#filterUI").html('<form action="javascript:filterDynamicWithTag()"><select id="selectUpTag"></select><input type="submit" value="筛选"></form>')
  $("#selectUpTag").append(tagged.map(t => '<option value="' + t.tagid + '">' + t.name + '</option>').join()).val(0)
})