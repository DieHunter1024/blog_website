const axios = require("axios");
const cheerio = require("cheerio");
const html2md = require("html-to-md");
const singleLineLog = require("single-line-log").stdout;
const path = require("path");
const fs = require("fs");
const { messageCenter } = require("event-message-center");
const { defer, stringToJson } = require("utils-lib-js");
// 配置默认值
const defaultVal = {
  type: "csdn",
  id: "time_____",
  update: false,
};
// 各类博客的配置项
const blogConfig = {
  csdn: {
    // 博客分页：page:第几页,size:分页大小,businessType:排序方式，blog表示博客
    pageConfig: {
      page: 1,
      size: 10,
      businessType: "blog",
    },
    totalPage: 1, //总页数
    blogList: [],
    // 博客列表
    blogListUrl:
      "https://blog.csdn.net/community/home-api/v1/get-business-list",
    // 获取博客列表
    getBlogList() {
      return axios.get(this.blogListUrl, {
        params: {
          username: global.id,
          ...this.pageConfig,
        },
      });
    },
    getBlogItem(blog) {
      return axios.get(blog);
    },
    // 爬取数据的标签，有兴趣自己可以加
    getBlogInfo: {
      getContent: ($) => $("#content_views").html(),
      getTagsCategory: ($) => {
        const target = $(".tag-link");
        const tagsCategory = {
          tags: [],
          category: [],
        };
        for (let i = 0; i < target.length; i++) {
          const tag = target[i].children[0]["data"];
          // 通过属性data-report-click判断分类和标签
          (Object.keys(target[i].attribs).includes("data-report-click") &&
            tagsCategory["tags"].push(tag)) ||
            tagsCategory["category"].push(tag);
        }
        return tagsCategory;
      },
    },
  },
};
// 全局变量
const global = {};
// 异步函数
const asyncFunction = {
  // 分页获取博客列表
  getBlogList: async () => {
    const { data } = await getBlogConfig().getBlogList();
    getBlogConfig().totalPage = getTotalPage(
      data.total,
      getBlogConfig().pageConfig.size
    );
    getBlogConfig().blogList = concatList(data.list, getBlogConfig().blogList);
    data.list.forEach((_) => console.log(_.title));
    if (isInTotalPage()) {
      return asyncFunction["startLoadBlogItem"]();
    }
    setTimeout(async () => {
      await asyncFunction["getBlogList"]();
    }, 1000);
  },
  startLoadBlogItem: async () => {
    const newData = getBlogConfig().blogList;
    let temp = newData;
    console.log(`获取列表成功,共${newData.length}篇文章`);
    if (global.update) {
      const oldData = (await readFile(global.type, "./temp/")).toString(
        "utf-8"
      );
      // temp表示待导出的博客列表
      temp = getArrayAddItems(stringToJson(oldData) ?? [], newData);
      console.log(`本次更新${temp.length}篇文章`);
    }
    writeFile(global.type, JSON.stringify(newData), "./temp/");
    return messageCenter.emit("getBlogInfo", temp);
  },
  //批量获取博客详情
  getBlogInfo: async (blogList, count = 0, total = blogList.length ?? 0) => {
    const blogItem = blogList[count];
    if (count++ >= total) {
      console.log("获取文章内容成功");
      return messageCenter.emit("loadBlog", blogList);
    }
    // 进度条
    progressBar("获取文章内容中", count / total);
    blogItem.htmlContent = await getBlogConfig().getBlogItem(blogItem.url);
    asyncFunction["getBlogInfo"](blogList, count, total);
  },
  // 生成博客文件
  loadBlog: async (blogList) => {
    const getTagsCategory = getBlogConfig().getBlogInfo.getTagsCategory;
    const content = getBlogConfig().getBlogInfo.getContent;
    await Promise.all(
      blogList.map((_) => {
        const $ = cheerio.load(_.htmlContent);
        const { tags, category } = getTagsCategory($);
        return createMdFile(_.title, content($), _.postTime, tags, category);
      })
    );
    messageCenter.emit("loadFinish");
  },
  loadFinish() {
    console.log("导出成功");
  },
};
// 初始化script参数
(function (argv) {
  global.type = getValue(filterArgs(argv, "type")[0], ":") ?? defaultVal.type;
  global.id = getValue(filterArgs(argv, "id")[0], ":") ?? defaultVal.id;
  global.update = !!(filterArgs(argv, "-update")[0] ?? defaultVal.update);
  initAxios();
  init();
  messageCenter.emit("getBlogList");
})(process.argv);
function init() {
  messageCenter.on("getBlogList", asyncFunction["getBlogList"]);
  messageCenter.on("getBlogInfo", asyncFunction["getBlogInfo"]);
  messageCenter.on("loadBlog", asyncFunction["loadBlog"]);
  messageCenter.on("loadFinish", asyncFunction["loadFinish"]);
}
// 生成进度条
function progressBar(label, percentage, totalBar = 50) {
  const empty = "░";
  const step = "█";
  const target = (percentage * totalBar).toFixed();
  const bar = [];
  for (let i = 0; i < totalBar; i++) {
    (target >= i && (bar[i] = step)) || (bar[i] = empty);
  }
  singleLineLog(
    `${label || ""}  ${bar.join("")}${(100 * percentage).toFixed(2)}%`
  );
}
// 获取页数
function getTotalPage(total, size) {
  return Math.round(total / size);
}
// 是否是最后一页
function isInTotalPage() {
  return getBlogConfig().pageConfig.page++ > getBlogConfig().totalPage;
}
// npm script参数判断
function filterArgs(args, key) {
  return args.filter((_) => _.includes(key));
}
// 拆分字符串
function getValue(str, keyWord) {
  return typeof str === "string" && str.split(keyWord)[1];
}
// 替换特殊字符
function replaceKey(str) {
  const exp = /[`\/：*？\"<>|\s]/g;
  // /[`~!@#$^&*()=|{}':;',\\\[\]\.<>\/?~！@#￥……&*（）——|{}【】'；：""'。，、？\s]/g;
  return str.replace(exp, " ");
}
// 连接列表数组
function concatList(list, targetList) {
  return [...targetList, ...list];
}

// 生成博客md,title文章标题, content文章内容, date文章时间, tags文章标签, category文章分类
function createMdFile(title, content, date, tags, category) {
  return writeFile(
    `${replaceKey(title)}.md`,
    `${createMdTemplete(title, date, tags, category)}${html2md(content)}`,
    "./source/_posts/"
  );
}
// md文件模板配置
function createMdTemplete(title, date, tags, category) {
  return `---\ntitle:  ${title} \ndate:  ${date} \ntags:  [${tags}] \ncategory:  [${category}] \n---\n`;
}
// 写入文件
function writeFile(filename, data, dir) {
  const { reject, resolve, promise } = defer();
  fs.writeFile(
    path.join(__dirname, dir + filename),
    data,
    (err) => (err && reject(err)) || resolve(err)
  );
  return promise;
}

// 读取文件
function readFile(filename, dir) {
  const { reject, resolve, promise } = defer();
  fs.readFile(
    path.join(__dirname, dir + filename),
    (err, data) => (err && reject(err)) || resolve(data)
  );
  return promise;
}
//响应拦截器
function initAxios() {
  axios.interceptors.response.use(
    function ({ data, status }) {
      if (data.code === 200 || status === 200) {
        return data;
      }
      return Promise.reject(data);
    },
    function (error) {
      // 对响应错误做点什么
      console.log(error);
      return Promise.reject(error);
    }
  );
}

// 获取数组更新项
function getArrayAddItems(oldList = [], newList = [], key = "title") {
  return newList.filter((it) => !!!oldList.find((i) => i[key] === it[key]));
}

// 通过博客类型获取博客数据
function getBlogConfig() {
  return blogConfig[global.type];
}
