module.exports={
 appId:'de.nexuscommander.desktop',productName:'Nexus Commander',
 directories:{output:'releases/windows'},
 files:['desktop/**/*','package.json','!desktop/server-entry.ts','!node_modules/**/*'],
 extraResources:[{from:'desktop-runtime',to:'runtime'}],
 asar:true,npmRebuild:false,
 win:{target:[{target:'nsis',arch:['x64']}],artifactName:'Nexus-Commander-Setup-${version}.${ext}',icon:'desktop/icon.ico',signExecutable:false},
 nsis:{oneClick:false,perMachine:false,allowToChangeInstallationDirectory:true,createDesktopShortcut:true,createStartMenuShortcut:true,deleteAppDataOnUninstall:false},
 publish:null
};
