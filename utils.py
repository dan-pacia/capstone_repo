from datetime import datetime

def convert_timestamp(value):
    """Convert a timestamp (string or number) to ISO 8601 UTC string."""
    try:
        # Check for None values
        if value is None:
            return value

        # check if number (should be unix timestamp)
        if isinstance(value, (int, float)):
            return datetime.utcfromtimestamp(value).isoformat() + "Z"
        
        # If string, handle both ISO 8601 and space separated formats
        elif isinstance(value, str):
            # Handle 'YYYY-MM-DD HH:MM:SS' format (space separated)
            if " " in value and len(value) == 19:  # Basic check for 'YYYY-MM-DD HH:MM:SS'
                try:
                    dt = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
                    return dt.isoformat() + "Z"
                except ValueError:
                    return value  # Return original if it can't be parsed
            
            # Handle ISO 8601 format or similar
            try:
                dt = datetime.fromisoformat(value.replace("Z", ""))
                return dt.isoformat() + "Z"
            except ValueError:
                return value  # Return as-is if parsing fails

        else:
            return value  # Return as-is if it's neither a string nor a number

    except Exception as e:
        print(f"Error converting timestamp: {e}")
        return value  # Return original value in case of unexpected error