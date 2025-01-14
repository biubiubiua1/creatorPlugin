/*
 * @CreateTime: Nov 11, 2020 3:04 PM 
 * @Author: howe 
 * @Contact: ihowe@outlook.com 
* @Last Modified By: howe
* @Last Modified Time: Nov 11, 2020 3:09 PM
 * @Description: Cocos Sprite9EditorEx plugin!
 */


'use strict';
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const PNG = require("pngjs").PNG;
const { webContents, ipcMain } = require('electron')

const trace = Editor.log;

let projectPath = "";
try {
    projectPath = Editor.Project.path;
} catch (e) {
    projectPath = Editor.projectInfo.path;
}

let spriteEditHandler = async function (webcontent) {
    let jscode = `
    if (document.querySelector("#btn_crop") == null) {
        console.log("插入btn_crop")
        let div_container = document.createElement("div");
        div_container.style.cssText = "position:fixed;bottom:10px;left:10px;display: flex;align-items:center;";
        document.body.appendChild(div_container);
        let btn_crop = document.createElement("ui-button");
        btn_crop.id = "btn_crop";
        btn_crop.innerText = "Cropping Image";
        // btn_crop.style.cssText = "position:fixed;bottom:20px;left:40px";
        btn_crop.onclick = function () {
            let elements = document.querySelectorAll('editor-unit-input');
            let crops = {};
            crops["override"] = check_isOverride.value;
            if (elements && elements.length > 0) {
                // 兼容 2.1.x
                for (let inputElement of elements) {
                    crops[inputElement.id] = inputElement.value;
                }
            } else {
                // 兼容2.2.x+
                // 遍历当前的所有ui-num-input
                try{
                    elements = document.querySelector('ui-panel-frame').shadowRoot.querySelectorAll('ui-num-input');
                    for (let inputElement of elements) {
                        let attrs = inputElement.attributes;
                        let object = {};
                        for (let aaa of attrs) {
                            if (aaa.name == "id") {
                                object.id = aaa.value;
                            }
                            if (aaa.name == "value") {
                                object.value = aaa.value;
                            }
                        }
                        crops[object.id] = object.value
                    }
                }catch(e){
                    Editor.Dialog.messageBox({ type: "info", message: "不支持裁剪，请使用2.1.x以及以上的引擎再试！ " });
                    return;
                }
            }
            Editor.Ipc.sendToMain('sprite9editor:cropImage', {
                url: location.href,
                crops: crops
            });
        }
        div_container.appendChild(btn_crop);

        let check_isOverride = document.createElement("ui-checkbox");
        check_isOverride.id = "check_isOverride";
        check_isOverride.innerText = "Override";
        // check_isOverride.style.cssText = "position:fixed;bottom:20px;left:10px";
        div_container.appendChild(check_isOverride);

        require('electron').ipcRenderer.on('sprite9editor:imgcropFinished', function (event, args) {
            console.log(event, args)
            // Editor.assetdb.import([args], 'db://assets/resources');
            Editor.assetdb.refresh(args.db);
            // const {getCurrentWindow, globalShortcut} = require('electron').remote;
            // getCurrentWindow().reload();
        });
    }
    `;
    try {
        let res = await webcontent.executeJavaScript(jscode, true)
        // trace("[Sprite9Editor] executeJavaScript ret", res)
    } catch (e) {
        trace("[Sprite9Editor] error", e)
    }
    // webcontent.on('did-finish-load', async function () {
    //     try {
    //         let res = await webcontent.executeJavaScript(jscode, true)
    //         trace("[Sprite9Editor] did-finish-load", res)
    //     } catch (e) {
    //         trace("[Sprite9Editor]", e)
    //     }
    // })

}

module.exports = {
    load() {
        // execute when package 
        // if (!Editor.Panel.$open) {
        //     Editor.Panel.$open = Editor.Panel.open;
        //     Editor.Panel.open = function (...args) {
        //         Editor.Panel.$open(...args);
        //         // trace(...args, args.length)
        //         setTimeout(() => {
        //             for (let webcontent of webContents.getAllWebContents()) {
        //                 // Editor.log("*******" + webcontent.id + webcontent.getTitle(), webcontent.getURL());
        //                 if (webcontent.getURL().indexOf("sprite-editor") > 0) {
        //                     spriteEditHandler(webcontent);
        //                 }
        //             }
        //         }, 300)
        //     }
        // }
        trace("Sprite9Editor Plugin loaded");
    },

    unload() {
        // execute when package unloaded
    },

    // register your ipc messages here
    messages: {
        'did-finish-load'() {
            trace("did-finish-load");
        },
        'editor:panel-open'(...args) {
            trace("editor:panel-open")
            setTimeout(() => {
                for (let webcontent of webContents.getAllWebContents()) {
                    // Editor.log("*******" + webcontent.id + webcontent.getTitle(), webcontent.getURL());
                    if (webcontent.getURL().indexOf("sprite-editor") > 0) {
                        spriteEditHandler(webcontent);
                    }
                }
            }, 300)
        },
        'sprite9editor:open'() {
            // open entry panel registered in package.json
            Editor.Panel.open('sprite9editor');
        },
        'sprite9editor:cropImage'(event, params) {
            // open entry panel registered in package.json
            let fileInfo = JSON.parse(decodeURIComponent(params.url).split("#")[1]);
            // trace("[Sprite9Editor] panelArgv", fileInfo["panelArgv"]);
            let crops = params.crops;
            trace("[Sprite9Editor] crops", crops);
            // 找到该图片
            let fileuuid = fileInfo["panelArgv"]['uuid'];
            let imgjsonpath = path.join(projectPath, "library", 'imports', fileuuid.substr(0, 2), fileuuid + ".json");
            if (!fse.existsSync(imgjsonpath)) {
                trace('[Sprite9Editor] ' + imgjsonpath + '不存在！');
                return;
            }
            let jsoninfo = JSON.parse(fse.readFileSync(imgjsonpath, 'utf8'));
            let uuidmtimepath = path.join(projectPath, "library", 'uuid-to-mtime.json');
            if (!fse.existsSync(uuidmtimepath)) {
                trace('[Sprite9Editor] ' + uuidmtimepath + '不存在！');
                return;
            }
            let uuidInfo = JSON.parse(fse.readFileSync(uuidmtimepath, 'utf8'));
            let imgInfo = uuidInfo[jsoninfo["content"]["texture"]];
            let imgrelativePath = imgInfo["relativePath"];
            if (!imgrelativePath) {
                return;
            }
            let imgPath = path.join(projectPath, "assets", imgrelativePath);
            if (!imgPath.endsWith(".png")) {
                Editor.Dialog.messageBox({ type: "info", message: "抱歉，工具暂时只支持PNG格式图片. " })
                return;
            }
            trace("[Sprite9Editor] file location: " + imgPath);
            let sizeL = parseInt(crops["inputL"]);
            let sizeR = parseInt(crops["inputR"])
            let sizeT = parseInt(crops["inputT"])
            let sizeB = parseInt(crops["inputB"])

            let sprite9Type = -1; // 0 是标准9宫格，1表示上中下9宫格，2表示左中右9宫格
            if (sizeB > 0 && sizeL > 0 && sizeR > 0 && sizeT > 0) {
                sprite9Type = 0;
            }
            if (sizeB > 0 && sizeT > 0 && sizeL == 0 && sizeR == 0) {
                sprite9Type = 1;
            }
            if (sizeB == 0 && sizeT == 0 && sizeL > 0 && sizeR > 0) {
                sprite9Type = 2;
            }
            if (sprite9Type < 0) {
                Editor.Dialog.messageBox({ type: "info", message: "参数错误，目前只支持标准9宫格、左中右和上中下三种模式，请修改参数以后再尝试. " })
                return;
            }
            fs.createReadStream(imgPath)
                .pipe(
                    new PNG({
                        filterType: 4,
                    })
                )
                .on("parsed", function () {
                    trace("[Sprite9Editor] OrignSize:  width = " + this.width + " height = " + this.height);
                    let de_width = sizeL + sizeR;
                    let de_height = sizeT + sizeB;
                    switch (sprite9Type) {
                        case 0: {
                            de_width = sizeL + sizeR;
                            de_height = sizeT + sizeB;
                            break;
                        }
                        case 1: {
                            de_width = this.width;
                            de_height = sizeT + sizeB;
                            break;
                        }
                        case 2: {
                            de_width = sizeL + sizeR;
                            de_height = this.height;
                            break;
                        }
                    }
                    let png = new PNG({
                        width: de_width,
                        height: de_height,
                        filterType: 4
                    });
                    trace("[Sprite9Editor] Regenerate Size width = " + png.width + " height = " + png.height)
                    if (sprite9Type == 0) {
                        for (let y = 0; y < this.height; y++) {
                            for (let x = 0; x < this.width; x++) {
                                let idx = (this.width * y + x) << 2;
                                // 左上
                                if (x <= sizeL && y <= sizeT) {
                                    let idx1 = (de_width * y + x) << 2
                                    png.data[idx1] = this.data[idx];
                                    png.data[idx1 + 1] = this.data[idx + 1];
                                    png.data[idx1 + 2] = this.data[idx + 2];
                                    png.data[idx1 + 3] = this.data[idx + 3];
                                    continue;
                                }
                                // 右上
                                if (x >= (this.width - sizeR) && y <= sizeT) {
                                    let _x = x - (this.width - sizeL - sizeR);
                                    let idx1 = (de_width * y + _x) << 2;
                                    png.data[idx1] = this.data[idx];
                                    png.data[idx1 + 1] = this.data[idx + 1];
                                    png.data[idx1 + 2] = this.data[idx + 2];
                                    png.data[idx1 + 3] = this.data[idx + 3];
                                    continue;
                                }
                                // 左下
                                if (x <= sizeL && y >= (this.height - sizeB)) {
                                    let _y = y - (this.height - sizeT - sizeB);
                                    let idx1 = (de_width * _y + x) << 2
                                    png.data[idx1] = this.data[idx];
                                    png.data[idx1 + 1] = this.data[idx + 1];
                                    png.data[idx1 + 2] = this.data[idx + 2];
                                    png.data[idx1 + 3] = this.data[idx + 3];
                                    continue;
                                }
                                // 右下
                                if (x >= (this.width - sizeR) && y >= (this.height - sizeB)) {
                                    let _y = y - (this.height - sizeT - sizeB);
                                    let _x = x - (this.width - sizeL - sizeR);
                                    let idx1 = (de_width * _y + _x) << 2;
                                    png.data[idx1] = this.data[idx];
                                    png.data[idx1 + 1] = this.data[idx + 1];
                                    png.data[idx1 + 2] = this.data[idx + 2];
                                    png.data[idx1 + 3] = this.data[idx + 3];
                                    continue;
                                }
                            }
                        }
                    }
                    if (sprite9Type == 1) {
                        for (let y = 0; y < this.height; y++) {
                            for (let x = 0; x < this.width; x++) {
                                let idx = (this.width * y + x) << 2;
                                // 上
                                if (y <= sizeT) {
                                    let idx1 = (de_width * y + x) << 2
                                    png.data[idx1] = this.data[idx];
                                    png.data[idx1 + 1] = this.data[idx + 1];
                                    png.data[idx1 + 2] = this.data[idx + 2];
                                    png.data[idx1 + 3] = this.data[idx + 3];
                                    continue;
                                }
                                // 下
                                if (y >= (this.height - sizeB)) {
                                    let _y = y - (this.height - sizeT - sizeB);
                                    let idx1 = (de_width * _y + x) << 2
                                    png.data[idx1] = this.data[idx];
                                    png.data[idx1 + 1] = this.data[idx + 1];
                                    png.data[idx1 + 2] = this.data[idx + 2];
                                    png.data[idx1 + 3] = this.data[idx + 3];
                                    continue;
                                }
                            }
                        }
                    }

                    if (sprite9Type == 2) {
                        for (let y = 0; y < this.height; y++) {
                            for (let x = 0; x < this.width; x++) {
                                let idx = (this.width * y + x) << 2;
                                // 左
                                if (x <= sizeL) {
                                    let idx1 = (de_width * y + x) << 2
                                    png.data[idx1] = this.data[idx];
                                    png.data[idx1 + 1] = this.data[idx + 1];
                                    png.data[idx1 + 2] = this.data[idx + 2];
                                    png.data[idx1 + 3] = this.data[idx + 3];
                                    continue;
                                }
                                // 右
                                if (x >= (this.width - sizeR)) {
                                    let _x = x - (this.width - sizeL - sizeR);
                                    let idx1 = (de_width * y + _x) << 2;
                                    png.data[idx1] = this.data[idx];
                                    png.data[idx1 + 1] = this.data[idx + 1];
                                    png.data[idx1 + 2] = this.data[idx + 2];
                                    png.data[idx1 + 3] = this.data[idx + 3];
                                    continue;
                                }
                            }
                        }
                    }
                    let newPngpath = imgPath.replace(".png", "_9grid.png");
                    if (crops["override"]) {
                        newPngpath = imgPath;
                        trace("[Sprite9Editor] Override origin file ! ")
                    }
                    let rs = png.pack();
                    let ws = fs.createWriteStream(newPngpath);
                    rs.pipe(ws);
                    ws.on('finish', () => {
                        let filepath = newPngpath.replace(/[\\]+/g, "/");
                        // event.sender.send("sprite9editor:imgcropFinished", { img: newPngpath, db: dbpath });
                        if (crops["override"]) {
                            // Editor.Dialog.messageBox({ type: "info", message: "图片已成功切割，下一步请重新打开Sprite Editor并设置新的图片分割线！" })
                            Editor.Panel.close("sprite-editor", () => {
                                let ddd = filepath.split("/assets");
                                let dbpath = 'db://assets/' + ddd[1];
                                Editor.assetdb.refresh(dbpath, () => {
                                    Editor.Panel.open("sprite-editor", { uuid: fileuuid })
                                });
                            })
                        } else {
                            filepath = path.dirname(filepath);
                            let ddd = filepath.split("/assets");
                            let dbpath = 'db://assets/' + ddd[1];
                            Editor.assetdb.refresh(dbpath);
                        }
                        trace("[Sprite9Editor] Finished.");
                    });
                });
        },
    },
};