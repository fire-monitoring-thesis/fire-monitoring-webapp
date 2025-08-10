
-- Enhanced Messages Table
DROP TABLE IF EXISTS messages;

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Add constraints
    CONSTRAINT messages_message_length CHECK (LENGTH(message) <= 1000),
    CONSTRAINT messages_type_check CHECK (message_type IN ('text', 'system', 'alert'))
);

-- Add indexes for better performance
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_type ON messages(message_type);

-- Insert some sample messages
INSERT INTO messages (user_id, message, message_type) VALUES 
(1, 'Welcome to the Fire Alarm System messaging platform!', 'system'),
(1, 'All emergency responders, please check your devices.', 'text');
