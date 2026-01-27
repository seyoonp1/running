const { withInfoPlist, withAndroidManifest, withPlugins, createRunOncePlugin } = require('@expo/config-plugins');

const withNaverMapIos = (config, { clientId }) => {
    return withInfoPlist(config, (config) => {
        config.modResults.NMFClientId = clientId;
        return config;
    });
};

const withNaverMapAndroid = (config, { clientId }) => {
    return withAndroidManifest(config, (config) => {
        const mainApplication = config.modResults.manifest.application[0];

        // meta-data 배열이 없으면 생성
        if (!mainApplication['meta-data']) {
            mainApplication['meta-data'] = [];
        }

        const metaDataArray = mainApplication['meta-data'];

        // 기존에 설정된 값이 있는지 확인
        const existingIndex = metaDataArray.findIndex(item => item.$['android:name'] === 'com.naver.maps.map.CLIENT_ID');

        const metaDataItem = {
            $: {
                'android:name': 'com.naver.maps.map.CLIENT_ID',
                'android:value': clientId,
            },
        };

        if (existingIndex !== -1) {
            metaDataArray[existingIndex] = metaDataItem;
        } else {
            metaDataArray.push(metaDataItem);
        }

        return config;
    });
};

const withNaverMap = (config, { clientId }) => {
    return withPlugins(config, [
        [withNaverMapIos, { clientId }],
        [withNaverMapAndroid, { clientId }],
    ]);
};

module.exports = createRunOncePlugin(withNaverMap, 'withNaverMap', '1.0.0');
