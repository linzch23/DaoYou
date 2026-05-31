from enum import IntEnum


class ErrorCode(IntEnum):
    INVALID_REQUEST = 4000
    NOT_FOUND = 4001
    UPLOAD_FAILED = 4002
    SERVER_ERROR = 5000
    LLM_FAILED = 5001
    MAP_API_FAILED = 5002
    AGENT_OUTPUT_INVALID = 5003


class AppError(Exception):
    def __init__(self, code: ErrorCode, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)

