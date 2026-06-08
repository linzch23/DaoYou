def list_trashed_trips(user_id: int) -> dict[str, list[dict[str, object]]]:
    return {"trips": []}


def restore_trashed_trip(user_id: int, trip_id: int) -> dict[str, bool]:
    return {"restored": True}


def permanently_delete_trashed_trip(user_id: int, trip_id: int) -> dict[str, bool]:
    return {"permanently_deleted": True}


def empty_trip_trash(user_id: int) -> dict[str, int]:
    return {
        "permanently_deleted_count": 0,
        "file_cleanup_failed_count": 0,
    }
