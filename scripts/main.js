let dialog;
let input;
let configDialog;
let configList = [];
let selectedConfig = null;
let mainButton;
let linkButton;

const delay = 150;
const maxLen = 100;
const CONFIG_FILE = "flooder_configs.json";

let queue = [];
let timer = 0;
let isFlooding = false;

function saveConfigs() {
    let data = {
        configs: configList
    };
    Core.settings.put(CONFIG_FILE, JSON.stringify(data));
}

function loadConfigs() {
    let data = Core.settings.getString(CONFIG_FILE, "{}");
    try {
        let parsed = JSON.parse(data);
        configList = parsed.configs || [];
    } catch(e) {
        configList = [];
    }
}

function splitMessage(text){
    let parts = [];

    for(let i = 0; i < text.length; i += maxLen){
        let chunk = text.substring(i, i + maxLen);

        if(i + maxLen < text.length){
            chunk += "...";
        }

        parts.push(chunk);
    }

    return parts;
}

Events.run(Trigger.update, () => {
    if(queue.length === 0) {
        isFlooding = false;
        return;
    }

    isFlooding = true;
    timer += Time.delta;

    if(timer >= delay){
        timer = 0;
        let msg = queue.shift();

        if(msg && msg.trim().length > 0){
            Call.sendChatMessage(msg);
        }
    }
});

function stopFlood() {
    queue = [];
    timer = 0;
    isFlooding = false;
    Vars.ui.showInfo("Flood stopped!");
}

function showEditConfigDialog(config, index) {
    let editDialog = new BaseDialog("Edit Config");
    
    let nameField = new TextField();
    nameField.setText(config.name);
    nameField.setMessageText("Name");
    
    let textArea = new TextArea("");
    textArea.setText(config.text);
    textArea.setMessageText("Text");
    
    editDialog.cont.add("Name:").row();
    editDialog.cont.add(nameField).size(300, 50).row();
    editDialog.cont.add("Text:").row();
    editDialog.cont.add(textArea).size(450, 200).row();
    
    let buttonTable = new Table();
    
    let saveBtn = new Button();
    saveBtn.add("Save");
    saveBtn.clicked(() => {
        let newName = nameField.getText().trim();
        let newText = textArea.getText().trim();
        
        if(newName.length === 0) {
            Vars.ui.showInfo("Enter name!");
            return;
        }
        
        if(newText.length === 0) {
            Vars.ui.showInfo("Enter text!");
            return;
        }
        
        let nameExists = configList.some((c, i) => c.name === newName && i !== index);
        if(nameExists) {
            Vars.ui.showInfo("Config with this name already exists!");
            return;
        }
        
        configList[index] = {
            name: newName,
            text: newText
        };
        
        saveConfigs();
        Vars.ui.showInfo("Config updated!");
        editDialog.hide();
        showConfigDialog();
    });
    buttonTable.add(saveBtn).size(80, 50).pad(5);
    
    let cancelBtn = new Button();
    cancelBtn.add("Cancel");
    cancelBtn.clicked(() => {
        editDialog.hide();
    });
    buttonTable.add(cancelBtn).size(80, 50).pad(5);
    
    editDialog.cont.add(buttonTable).row();
    
    editDialog.show();
}

function showImportDialog() {
    let importDialog = new BaseDialog("Import Configs");
    
    let textArea = new TextArea("");
    textArea.setMessageText("Paste JSON configs here...");
    
    importDialog.cont.add("Paste JSON data:").row();
    importDialog.cont.add(textArea).size(450, 250).row();
    
    let importBtn = new Button();
    importBtn.add("Import");
    importBtn.clicked(() => {
        let jsonText = textArea.getText().trim();
        if(jsonText.length === 0) {
            Vars.ui.showInfo("Enter JSON data!");
            return;
        }
        
        try {
            let imported = JSON.parse(jsonText);
            let importedConfigs = [];
            
            if(Array.isArray(imported)) {
                importedConfigs = imported;
            } else if(imported.configs && Array.isArray(imported.configs)) {
                importedConfigs = imported.configs;
            } else {
                Vars.ui.showInfo("Invalid format! Need array of configs or object with configs array");
                return;
            }
            
            let added = 0;
            let duplicates = 0;
            
            importedConfigs.forEach(imp => {
                if(imp.name && imp.text) {
                    let exists = configList.some(c => c.name === imp.name);
                    if(!exists) {
                        configList.push({
                            name: imp.name,
                            text: imp.text
                        });
                        added++;
                    } else {
                        duplicates++;
                    }
                }
            });
            
            if(added > 0) {
                saveConfigs();
                Vars.ui.showInfo("Imported " + added + " configs! Duplicates skipped: " + duplicates);
                importDialog.hide();
                showConfigDialog();
            } else {
                Vars.ui.showInfo("No new configs to import. Duplicates: " + duplicates);
            }
            
        } catch(e) {
            Vars.ui.showInfo("Invalid JSON format!");
        }
    });
    importDialog.cont.add(importBtn).size(150, 50).pad(5);
    
    importDialog.addCloseButton();
    importDialog.show();
}

function showExportSelectDialog() {
    let exportSelectDialog = new BaseDialog("Select Configs to Export");
    
    if(configList.length === 0) {
        exportSelectDialog.cont.add("No configs to export").pad(20).row();
        exportSelectDialog.addCloseButton();
        exportSelectDialog.show();
        return;
    }
    
    let selectedIndices = [];
    
    exportSelectDialog.cont.add("Select configs to export:").row();
    
    configList.forEach((config, index) => {
        let checkTable = new Table();
        
        let checkbox = new CheckBox(config.name);
        checkbox.changed(() => {
            if(checkbox.isChecked()) {
                if(!selectedIndices.includes(index)) {
                    selectedIndices.push(index);
                }
            } else {
                selectedIndices = selectedIndices.filter(i => i !== index);
            }
        });
        
        checkTable.add(checkbox).pad(5);
        exportSelectDialog.cont.add(checkTable).row();
    });
    
    exportSelectDialog.cont.row();
    
    let selectAllBtn = new Button();
    selectAllBtn.add("Select All");
    selectAllBtn.clicked(() => {
        selectedIndices = [];
        for(let i = 0; i < configList.length; i++) {
            selectedIndices.push(i);
        }
        exportSelectDialog.hide();
        showExportDialog(selectedIndices);
    });
    exportSelectDialog.cont.add(selectAllBtn).size(150, 50).pad(5);
    
    let exportBtn = new Button();
    exportBtn.add("Export Selected");
    exportBtn.clicked(() => {
        if(selectedIndices.length === 0) {
            Vars.ui.showInfo("Select at least one config!");
            return;
        }
        exportSelectDialog.hide();
        showExportDialog(selectedIndices);
    });
    exportSelectDialog.cont.add(exportBtn).size(150, 50).pad(5);
    
    exportSelectDialog.addCloseButton();
    exportSelectDialog.show();
}

function showExportDialog(selectedIndices) {
    let exportDialog = new BaseDialog("Export Configs");
    
    let selectedConfigs = [];
    selectedIndices.forEach(index => {
        selectedConfigs.push(configList[index]);
    });
    
    let jsonData = JSON.stringify(selectedConfigs, null, 2);
    
    let textArea = new TextArea("");
    textArea.setText(jsonData);
    textArea.setMessageText("Your configs JSON");
    
    exportDialog.cont.add("Exported " + selectedConfigs.length + " config(s):").row();
    exportDialog.cont.add(textArea).size(450, 250).row();
    
    let selectAllBtn = new Button();
    selectAllBtn.add("Select All");
    selectAllBtn.clicked(() => {
        textArea.selectAll();
    });
    exportDialog.cont.add(selectAllBtn).size(150, 40).pad(5);
    
    let copyBtn = new Button();
    copyBtn.add("Copy to Clipboard");
    copyBtn.clicked(() => {
        Core.app.setClipboardText(jsonData);
        Vars.ui.showInfo("Configs copied to clipboard!");
    });
    exportDialog.cont.add(copyBtn).size(200, 50).pad(5);
    
    exportDialog.addCloseButton();
    exportDialog.show();
}

function showConfigDialog() {
    if(!configDialog) {
        configDialog = new BaseDialog("Configs");
    }
    
    configDialog.cont.clear();
    
    if(configList.length > 0) {
        configDialog.cont.add("Saved texts:").row();
        
        configList.forEach((config, index) => {
            let table = new Table();
            
            table.add(config.name).width(150).pad(5);
            
            let loadBtn = new Button();
            loadBtn.add("Load");
            loadBtn.clicked(() => {
                input.setText(config.text);
                selectedConfig = config;
                Vars.ui.showInfo("Loaded: " + config.name);
                configDialog.hide();
            });
            table.add(loadBtn).size(60, 40).pad(2);
            
            let editBtn = new Button();
            editBtn.add("Edit");
            editBtn.clicked(() => {
                showEditConfigDialog(config, index);
            });
            table.add(editBtn).size(60, 40).pad(2);
            
            let delBtn = new Button();
            delBtn.add("X");
            delBtn.clicked(() => {
                configList.splice(index, 1);
                saveConfigs();
                showConfigDialog();
            });
            table.add(delBtn).size(40, 40).pad(2);
            
            configDialog.cont.add(table).row();
        });
    } else {
        configDialog.cont.add("No saved configs").pad(20).row();
    }
    
    let buttonTable = new Table();
    
    let createBtn = new Button();
    createBtn.add("Create");
    createBtn.clicked(() => {
        showCreateConfigDialog();
    });
    buttonTable.add(createBtn).size(100, 50).pad(5);
    
    let importBtn = new Button();
    importBtn.add("Import");
    importBtn.clicked(() => {
        showImportDialog();
    });
    buttonTable.add(importBtn).size(100, 50).pad(5);
    
    let exportBtn = new Button();
    exportBtn.add("Export");
    exportBtn.clicked(() => {
        showExportSelectDialog();
    });
    buttonTable.add(exportBtn).size(100, 50).pad(5);
    
    configDialog.cont.add(buttonTable).row();
    
    let closeBtn = new Button();
    closeBtn.add("Close");
    closeBtn.clicked(() => {
        configDialog.hide();
    });
    configDialog.cont.add(closeBtn).size(150, 40);
    
    configDialog.show();
}

function showCreateConfigDialog() {
    let createDialog = new BaseDialog("Create Config");
    
    let nameField = new TextField();
    nameField.setMessageText("Enter config name");
    
    createDialog.cont.add("Name:").row();
    createDialog.cont.add(nameField).size(300, 50).row();
    
    let saveBtn = new Button();
    saveBtn.add("Save");
    saveBtn.clicked(() => {
        let name = nameField.getText().trim();
        let text = input.getText().trim();
        
        if(name.length === 0) {
            Vars.ui.showInfo("Enter name!");
            return;
        }
        
        if(text.length === 0) {
            Vars.ui.showInfo("Enter text in main field!");
            return;
        }
        
        let exists = configList.some(c => c.name === name);
        if(exists) {
            Vars.ui.showInfo("Config with this name already exists!");
            return;
        }
        
        configList.push({
            name: name,
            text: text
        });
        
        saveConfigs();
        Vars.ui.showInfo("Config saved!");
        createDialog.hide();
        showConfigDialog();
        
    });
    createDialog.cont.add(saveBtn).size(100, 50).row();
    
    let cancelBtn = new Button();
    cancelBtn.add("Cancel");
    cancelBtn.clicked(() => {
        createDialog.hide();
    });
    createDialog.cont.add(cancelBtn).size(100, 40);
    
    createDialog.show();
}

function createDialog(){
    dialog = new BaseDialog("Flooder");

    input = new TextArea("");
    input.setMessageText("Enter text... Mod by https://t.me/schizo_mell");

    dialog.cont.add(input).size(500, 300).row();

    let clearBtn = new Button();
    clearBtn.add("Clear");
    clearBtn.clicked(() => {
        input.setText("");
    });
    dialog.cont.add(clearBtn).size(100, 40).padBottom(10).row();

    let buttonTable = new Table();
    
    let sendBtn = new Button();
    sendBtn.add("Send");
    sendBtn.clicked(() => {
        let text = input.getText();
        if(!text || text.trim() === "") return;

        let lines = text.split("\n");

        lines.forEach(line => {
            if(line.trim().length > 0){
                let parts = splitMessage(line.trim());
                queue = queue.concat(parts);
            }
        });

        dialog.hide();
    });
    buttonTable.add(sendBtn).size(150, 60).pad(5);
    
    let configBtn = new Button();
    configBtn.add("Configs");
    configBtn.clicked(() => {
        showConfigDialog();
    });
    buttonTable.add(configBtn).size(150, 60).pad(5);
    
    dialog.cont.add(buttonTable).row();
    
    let stopBtn = new Button();
    stopBtn.add("Stop Flood");
    stopBtn.clicked(() => {
        stopFlood();
    });
    dialog.cont.add(stopBtn).size(310, 60).padTop(10).row();
    
    let tgBtn = new Button();
    tgBtn.add("Telegram");
    tgBtn.clicked(() => {
        Vars.ui.showInfo("Telegram: t.me/schizo_mell\n\nLink copied to clipboard!");
        Core.app.setClipboardText("https://t.me/schizo_mell");
    });
    dialog.cont.add(tgBtn).size(310, 50).padTop(5).row();

    dialog.addCloseButton();
}

Events.on(ClientLoadEvent, () => {
    
    loadConfigs();
    
    createDialog();

    mainButton = new Button();
    mainButton.add("Open Flooder");
    
    mainButton.clicked(() => {
        dialog.show();
    });
    
    mainButton.pack();
    mainButton.setSize(mainButton.getWidth() + 20, mainButton.getHeight() + 10);
    mainButton.setPosition(1500, 1100);
    
    Vars.ui.hudGroup.addChild(mainButton);

    linkButton = new Button();
    linkButton.add("t.me/schizo_mell");
    linkButton.clicked(() => {
        Vars.ui.showInfo("Telegram: t.me/schizo_mell\n\nLink copied to clipboard!");
        Core.app.setClipboardText("https://t.me/schizo_mell");
    });
    linkButton.pack();
    linkButton.setSize(linkButton.getWidth() + 15, linkButton.getHeight() + 8);
    linkButton.setPosition(
        Vars.ui.hudGroup.getWidth() - linkButton.getWidth() - 10, 
        Vars.ui.hudGroup.getHeight() - linkButton.getHeight() - 10
    );
    
    Vars.ui.hudGroup.addChild(linkButton);
    
    let quickStopBtn = new Button();
    quickStopBtn.add("Stop");
    quickStopBtn.clicked(() => {
        stopFlood();
    });
    quickStopBtn.pack();
    quickStopBtn.setSize(60, 40);
    quickStopBtn.setPosition(10, Vars.ui.hudGroup.getHeight() - 50);
    
    Vars.ui.hudGroup.addChild(quickStopBtn);
});
