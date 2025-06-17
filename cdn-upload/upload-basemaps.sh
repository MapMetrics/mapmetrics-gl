#!/bin/bash

SOURCE_DIR="/Users/jimvanderheiden/devprog2/untitledfolder/basemaps-assets"
BUCKET="mapmetrics-cdn"
TARGET_FOLDER="basemaps-assets"

# Function to get content type
get_content_type() {
    local file=$1
    case "${file##*.}" in
        pbf) echo "--content-type=application/x-protobuf" ;;
        png) echo "--content-type=image/png" ;;
        jpg|jpeg) echo "--content-type=image/jpeg" ;;
        json) echo "--content-type=application/json" ;;
        css) echo "--content-type=text/css" ;;
        js) echo "--content-type=application/javascript" ;;
        *) echo "" ;;
    esac
}

# Function to upload a file
upload_file() {
    local file=$1
    local relative_path=${file#$SOURCE_DIR/}
    local target_path="$BUCKET/$TARGET_FOLDER/$relative_path"
    
    # Skip system files
    if [[ "$(basename "$file")" == ".DS_Store" ]] || [[ "$(basename "$file")" == "Thumbs.db" ]]; then
        echo "⏩ Skipping system file: $relative_path"
        return
    fi
    
    echo "Uploading: $relative_path"
    
    # Get content type
    local content_type=$(get_content_type "$file")
    
    # Upload file
    if wrangler r2 object put "$target_path" --file="$file" $content_type --remote; then
        echo "✅ Uploaded: $relative_path"
    else
        echo "❌ Failed to upload: $relative_path"
    fi
}

# Function to process directory
process_directory() {
    local dir=$1
    
    # Process all files in directory
    for file in "$dir"/*; do
        if [ -d "$file" ]; then
            process_directory "$file"
        else
            upload_file "$file"
        fi
    done
}

echo "Starting upload of basemaps assets to $TARGET_FOLDER folder..."
process_directory "$SOURCE_DIR"
echo "Upload complete!" 