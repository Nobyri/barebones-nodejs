import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';

export const handler = async (event) => {
  try {
    // Parse request body
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { user_id, password, service_id, year_month } = body;

    if (!user_id || !password || !service_id || !year_month) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: user_id, password, service_id, year_month' })
      };
    }

    // Step 1: Login to get AWS credentials
    const loginResponse = await fetch('https://api.c.nuro.jp/auth-api/api/v2/authn/mypage/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, password })
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      return {
        statusCode: loginResponse.status,
        body: JSON.stringify({ error: 'Login failed', details: errorText })
      };
    }

    const loginData = await loginResponse.json();
    const credentials = loginData.credentials;

    if (!credentials) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'No credentials in login response', loginData })
      };
    }

    // Step 2: Create signature for invoice API
    const invoiceUrl = `https://api.c.nuro.jp/nurohikari-mypage-api/api/read/v2/services/${service_id}/download/invoice_pdf/${year_month}/nuro`;
    const url = new URL(invoiceUrl);

    const signer = new SignatureV4({
      service: 'execute-api',
      region: 'ap-northeast-1',
      credentials: {
        accessKeyId: credentials.access_key_id,
        secretAccessKey: credentials.access_secret,
        sessionToken: credentials.session_token
      },
      sha256: Sha256
    });

    const signedRequest = await signer.sign({
      method: 'GET',
      hostname: url.hostname,
      path: url.pathname,
      protocol: url.protocol,
      headers: {
        host: url.hostname
      }
    });

    // Step 3: Fetch invoice
    const signedHeaders = signedRequest.headers;
    const invoiceResponse = await fetch(invoiceUrl, {
      method: 'GET',
      headers: signedHeaders
    });

    if (!invoiceResponse.ok) {
      const errorText = await invoiceResponse.text();
      return {
        statusCode: invoiceResponse.status,
        body: JSON.stringify({ 
          error: 'Invoice fetch failed', 
          details: errorText 
        })
      };
    }

    // Parse JSON response containing Base64 PDF
    const responseData = await invoiceResponse.json();
    
    if (responseData.response_code !== 'normal') {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'API returned error', 
          response_code: responseData.response_code,
          details: responseData 
        })
      };
    }

    // Extract filename and Base64 PDF data
    const fileName = responseData.file_name || `invoice_${year_month}.pdf`;
    const pdfBase64 = responseData.data;

    if (!pdfBase64) {
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'No PDF data in response',
          details: responseData 
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filename: fileName,
        pdf_base64: pdfBase64
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal error', 
        message: error.message,
        stack: error.stack 
      })
    };
  }
};