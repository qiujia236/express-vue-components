/*-CREATE SERVER-*/
const express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    fs = require('fs'),
    SparkMD5 = require('spark-md5'),
    PORT = process.env.PORT || 8888,
    // url = `127.0.0.1`;
    url = `https://express-vue-components.herokuapp.com`;

//设置跨域访问
app.all('*', function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
    res.header("X-Powered-By", ' 3.2.1')
    res.header("Content-Type", "application/json;charset=utf-8");
    next();
});


app.use(bodyParser.urlencoded({
    extended: false,
    limit: '1024mb'
}));

/*-API-*/
const multiparty = require("multiparty");
const uploadDir = `${__dirname}/upload`;

function handleMultiparty(req, res, temp) {
    return new Promise((resolve, reject) => {
        // multiparty的配置
        let options = {
            maxFieldsSize: 200 * 1024 * 1024,
            uploadDir: !temp ? uploadDir : null
        };

        // !temp ? options.uploadDir = uploadDir : null;
        let form = new multiparty.Form(options);

        // multiparty解析
        form.parse(req, function (err, fields, files) {
            if (err) {
                res.send({
                    code: 1,
                    reason: err
                });
                reject(err);
                return;
            }

            resolve({
                fields,
                files
            });
        });
    });
}

// 基于FORM-DATA上传数据
app.post('/single1', async (req, res) => {
    let {
        files
    } = await handleMultiparty(req, res);
    let file = files.file[0];
    res.send({
        code: 0,
        originalFilename: file.originalFilename,
        path: file.path.replace(__dirname, `${url}:${PORT}`)
    });
});

// 上传BASE64
app.post('/single2', (req, res) => {
    let {
        chunk,
        filename
    } = req.body;

    // chunk的处理：转换为buffer
    chunk = decodeURIComponent(chunk);
    chunk = chunk.replace(/^data:image\/\w+;base64,/, "");
    chunk = Buffer.from(chunk, 'base64');

    // 存储文件到服务器
    let spark = new SparkMD5.ArrayBuffer(),
        suffix = /\.([0-9a-zA-Z]+)$/.exec(filename)[1],
        path;
    spark.append(chunk);
    path = `${uploadDir}/${spark.end()}.${suffix}`;
    fs.writeFileSync(path, chunk);
    res.send({
        code: 0,
        originalFilename: filename,
        path: path.replace(__dirname, `${url}:${PORT}`)
    });
});

// 切片上传 && 合并
app.post('/single3', async (req, res) => {
    let { fields, files } = await handleMultiparty(req, res, true);

    let [chunk] = files.chunk;
    let [filename] = fields.filename;
    let hash = /([0-9a-zA-Z]+)_\d+/.exec(filename)[1];
    // suffix = /\.([0-9a-zA-Z]+)$/.exec(file.name)[1],
    let path = `${uploadDir}/${hash}`;

    !fs.existsSync(path) ? fs.mkdirSync(path) : null;
    path = `${path}/${filename}`;

    fs.access(path, async err => {
        // 存在的则不再进行任何的处理
        if (!err) {
            res.send({
                code: 0,
                path: path.replace(__dirname, `${url}:${PORT}`)
            });
            return;
        }

        // 为了测试出效果，延迟1秒钟
        await new Promise(resolve => {
            setTimeout(_ => {
                resolve();
            }, 200);
        });

        // 不存在的再创建
        let readStream = fs.createReadStream(chunk.path),
            writeStream = fs.createWriteStream(path);
        readStream.pipe(writeStream);
        readStream.on('end', function () {
            fs.unlinkSync(chunk.path);
            res.send({
                code: 0,
                path: path.replace(__dirname, `${url}:${PORT}`)
            });
        });
    });
});

app.get('/merge', (req, res) => {
    const { hash } = req.query;
    const path = `${uploadDir}/${hash}`;
    const fileList = fs.readdirSync(path);
    let suffix = null;

    fileList.sort((a, b) => {
        const reg = /_(\d+)/;
        return reg.exec(a)[1] - reg.exec(b)[1];
    }).forEach(item => {
        if (!suffix) suffix = /\.([0-9a-zA-Z]+)$/.exec(item)[1];
        fs.appendFileSync(`${uploadDir}/${hash}.${suffix}`, fs.readFileSync(`${path}/${item}`));
        fs.unlinkSync(`${path}/${item}`);
    });
    fs.rmdirSync(path);

    res.send({
        code: 0,
        path: `${url}:${PORT}/upload/${hash}.${suffix}`
    });
});

app.use(express.static('./'));
app.use((req, res) => {
    res.status(404);
    res.send('NOT FOUND messages!');
});


app.listen(PORT, () => {
    console.log(`THE WEB SERVICE IS CREATED SUCCESSFULLY AND IS LISTENING TO THE PORT：${PORT}`);
});