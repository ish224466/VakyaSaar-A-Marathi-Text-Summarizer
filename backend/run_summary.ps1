# --- This is the final script using WebClient ---

# FIX #1: Force PowerShell to use the modern TLS 1.2 protocol
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

# 1. Set encoding
$OutputEncoding = [System.Text.Encoding]::UTF8

# 2. Read the text using the universal .NET method
Write-Host "Reading text from input.txt..."
$inputText = [System.IO.File]::ReadAllText("$PSScriptRoot\input.txt", [System.Text.Encoding]::UTF8)

# 3. Build the JSON body and convert it to a UTF-8 byte array
$bodyObject = @{ text = $inputText }
$bodyString = $bodyObject | ConvertTo-Json
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($bodyString)

# 4. Set up the WebClient
$uri = "http://127.0.0.1:8000/summarize-marathi"
$webClient = New-Object System.Net.WebClient
$webClient.Headers.Add("Content-Type", "application/json; charset=utf-8")

# 5. Call the API by uploading the byte array
Write-Host "Calling summarization API..."
try {
    # This method sends a byte array and returns a byte array. No broken auto-decoding.
    $rawResponseBytes = $webClient.UploadData($uri, "POST", $bodyBytes)
} catch {
    Write-Error "API call failed: $_"
    # Exit the script if the API call fails
    return
}

# 6. Manually decode the raw response bytes as UTF-8
Write-Host "Decoding API response..."
$jsonString = [System.Text.Encoding]::UTF8.GetString($rawResponseBytes)

# 7. Convert the correct JSON string into an object
$responseObject = $jsonString | ConvertFrom-Json

# 8. Save the summary to the output file
$summaryToAppend = "`n--- New Summary ---`n" + $responseObject.summary
Write-Host "Appending summary to summary_output.txt..."
Add-Content -Path "$PSScriptRoot\summary_output.txt" -Value $summaryToAppend -Encoding utf8

Write-Host "Done. Check summary_output.txt."

# --- End of script ---