const axios = require('axios');

const API_BASE_URL = 'http://localhost:8000';

const FormData = require('form-data');
const fs = require('fs');

const crypto = require('crypto');
const { execSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');

async function uploadFile(bucketName, filePath) {
  console.log(`Starting upload of file: ${filePath} to bucket: ${bucketName}`);
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  
  try {
    const response = await axios.post(`${API_BASE_URL}/buckets/${bucketName}/files`, form, {
      headers: form.getHeaders(),
    });
    console.log(`✅ Successfully uploaded file: ${filePath}`);
    console.log('Server response:', response.data);
  } catch (error) {
    console.error(`❌ Error uploading file: ${filePath}`);
    console.error(error.response ? error.response.data : error.message);
  }
}

async function downloadFile(bucketName, fileName, outputDir) {
    console.log(`Starting download of file: ${fileName} from bucket: ${bucketName}`);
    try {
      const response = await axios.get(`${API_BASE_URL}/buckets/${bucketName}/files/${fileName}/download`, {
        responseType: 'blob',
      });
      
      // Create output directory if it doesn't exist
      if (!fs.existsSync(`./${outputDir}`)) {
        fs.mkdirSync(`./${outputDir}`, { recursive: true });
      }
      
      const outputPath = `./${outputDir}/${fileName}`;
      fs.writeFileSync(outputPath, response.data);
      console.log(`✅ Successfully downloaded file to: ${outputPath}`);
    } catch (error) {
      console.error(`❌ Error downloading file: ${fileName}`);
      console.error(error.response ? error.response.data : error.message);
    }
}

async function apiRequest(method, endpoint, data = null) {
  console.log(`Making ${method} request to: ${endpoint}`);
  if (data) {
    console.log('Request data:', data);
  }
  
  try {
    const response = await axios({
      method,
      url: `${API_BASE_URL}${endpoint}`,
      data,
    });
    console.log(`✅ ${method} request successful`);
    console.log('Response:', response.data);
  } catch (error) {
    console.error(`❌ ${method} request failed`);
    console.error(error.response ? error.response.data : error.message);
  }
}

async function main() {
    const bucketName = Math.random().toString(36).substring(7);
    console.log(`\n🚀 Starting script with bucket name: ${bucketName}\n`);
    
    await apiRequest('POST', '/buckets', { bucketName: bucketName });
    await apiRequest('GET', '/buckets');
    await apiRequest('GET', `/buckets/${bucketName}`);
    
    // Create a random temp file
    const tempFileName = `file_${Date.now()}_${uuidv4()}_${Math.floor(Math.random() * 10000)}.bin`;
    const randomKey = crypto.randomBytes(32).toString('hex');
    console.log(`\n📁 Creating temporary encrypted file: ${tempFileName}`);
          
    // Store filename for later download
    const downloadFileName = tempFileName;
    try {
      execSync(`dd if=/dev/urandom bs=1M count=10 | openssl enc -aes-256-ctr -pass pass:"${randomKey}" -nosalt > "${tempFileName}"`);
      console.log(`✅ Created temporary encrypted file: ${tempFileName}`);
      
      // Upload the temp file
      console.log('\n📤 Uploading temporary encrypted file...');
      await uploadFile(bucketName, tempFileName);

      // Clean up - delete temp file
      fs.unlinkSync(tempFileName);
      console.log(`🗑️  Deleted temporary file: ${tempFileName}`);
    } catch (error) {
      console.error('❌ Error in file operations:', error);
      // Clean up in case of error
      if (fs.existsSync(tempFileName)) {
        fs.unlinkSync(tempFileName);
        console.log(`🗑️  Cleaned up temporary file after error: ${tempFileName}`);
      }
    }
    
    console.log('\n📋 Listing bucket files...');
    await apiRequest('GET', `/buckets/${bucketName}/files`);
    
    console.log('\n📥 Downloading previously uploaded file...');
    await downloadFile(bucketName, downloadFileName, './downloads');  

    console.log('\n✨ Script execution completed');
}

main();