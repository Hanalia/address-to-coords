const fs = require('fs');
const path = require('path');
const axios = require('axios');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const fastcsv = require('fast-csv');

const logger = require('./logger');


const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

const getNaverAddress = async (address) => {
    try {
        logger.debug(`Fetching Naver address for: ${address}`);

        const { data } = await axios.get('https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode', {
            params: { 'query': address },
            headers: {
                'X-NCP-APIGW-API-KEY-ID': config.NAVER_CLIENT_ID,
                'X-NCP-APIGW-API-KEY': config.NAVER_CLIENT_SECRET
            }
        });

        if (!data || !data.meta || !data.meta.totalCount) {
            logger.error(`Received unexpected data structure or null data for Naver address of: ${address}`);
            return null;
        }

        logger.debug(`Successfully fetched Naver address for: ${address}`);

        const { x, y, roadAddress: naverRoadAddress, jibunAddress: naverjibunAddress, addressElements } = data.addresses[0];
        const dongmyun = addressElements.find(item => item.types[0] == "DONGMYUN").shortName;

        return { x, y, naverRoadAddress, naverjibunAddress, dongmyun };
    } catch (error) {
        logger.error(`Error fetching Naver address for ${address}: ${error.message}`);
        return null;
    }
}

const getAddressDetails = async (jibunaddress, roadAddress) => {

    return await getNaverAddress(jibunaddress) || 
           await getNaverAddress(roadAddress) || 
           { x: "", y: "", naverRoadAddress: "", naverjibunAddress: "", dongmyun: "" };
}

const appendAddressDetails = async (data, jibunColumnName, roadColumnName) => {
    let successCount = 0;
    let failureCount = 0;
    for (let item of data) {
        const details = await getAddressDetails(item[jibunColumnName] || '', item[roadColumnName] || '');
        if (details.x && details.y) {
            successCount++;
        } else {
            failureCount++;
        }
        Object.assign(item, details);
    }

    logger.info(`Total items processed: ${data.length}. Successfully fetched: ${successCount}. Failed: ${failureCount}.`);
    return data;
}

const outputCSV = (data, outputPath) => {
    const ws = fs.createWriteStream(outputPath);
    fastcsv.write(data, { headers: true }).pipe(ws);
}

const outputXLSX = (data, outputPath) => {
    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
    xlsx.writeFile(wb, outputPath);
}

const readCSV = filepath => {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filepath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
    });
}

const readXLSX = filepath => {
    const workbook = xlsx.readFile(filepath);
    return xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
}

const processFile = async () => {
    const { inputFilePath, jibunColumnName, roadColumnName } = config;
    const ext = path.extname(inputFilePath);
    let data;

    if (ext === '.csv') {
        data = await readCSV(inputFilePath);
    } else if (ext === '.xlsx') {
        data = readXLSX(inputFilePath);
    } else {
        console.error('Unsupported file type');
        return;
    }

    data = await appendAddressDetails(data, jibunColumnName, roadColumnName);

    let outputPath;
    if (ext === '.csv') {
        outputPath = path.join(path.dirname(inputFilePath), 'output.csv');
        outputCSV(data, outputPath);
    } else if (ext === '.xlsx') {
        outputPath = path.join(path.dirname(inputFilePath), path.basename(inputFilePath, '.xlsx') + '_output.xlsx');
        outputXLSX(data, outputPath);
    }
}

if (require.main === module) {
    processFile();
}

module.exports = processFile;
