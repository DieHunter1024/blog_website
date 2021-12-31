<!--
 * @Author: Hunter
 * @Date: 2021-12-31 15:29:21
 * @LastEditTime: 2021-12-31 15:37:43
 * @LastEditors: Hunter
 * @Description: 
 * @FilePath: \Blog\README.md
 * 可以输入预定的版权声明、个性签名、空行等
-->

### 基于 node 编写的导出博客的爬虫脚本+hexo部署，可以搭配Jenkins一键将CSDN博客部署到自己服务器的博客中
### Jenkins流水线语句参考：https://gitee.com/DieHunter/blog_website/blob/master/pipeline
### 示例：http://website.diehunter1024.work/blog_website/
### 博客：https://blog.csdn.net/time_____/article/details/121995028
#### 脚本运行方式：
#### npm i
#### npm start
#### npm export_blog 或 node server -type:csdn -id:time_____
#### -type 表示博客类型
#### -id 表示用户名，如：在'https://blog.csdn.net/time_____'中，'time_____'是用户名
#### 默认导出目录：source/_posts
#### 导出效果是 markdown

#### hexo运行方式：
#### npm i hexo -g
#### npm start 或 hexo server -p 10245
#### 构建静态文件：
#### npm run build
#### 删除构建：
#### npm run clean