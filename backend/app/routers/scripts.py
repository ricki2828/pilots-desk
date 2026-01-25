"""
Script Management Router
Endpoints for managing script versions
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
import json
import logging
from datetime import datetime

from app.db.database import get_db
from app.db.models import ScriptVersion, Agent

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/versions")
async def list_script_versions(
    client_id: str,
    active_only: bool = False,
    db: Session = Depends(get_db)
):
    """List all script versions for a client"""
    query = db.query(ScriptVersion).filter(ScriptVersion.client_id == client_id)

    if active_only:
        query = query.filter(ScriptVersion.is_active == True)

    versions = query.order_by(desc(ScriptVersion.created_at)).all()

    return {
        "client_id": client_id,
        "versions": [
            {
                "id": str(v.id),
                "name": v.name,
                "version": v.version,
                "description": v.description,
                "is_active": v.is_active,
                "created_at": v.created_at.isoformat(),
                "activated_at": v.activated_at.isoformat() if v.activated_at else None
            }
            for v in versions
        ]
    }


@router.get("/versions/{version_id}")
async def get_script_version(version_id: str, db: Session = Depends(get_db)):
    """Get a specific script version with full schema"""
    version = db.query(ScriptVersion).filter(ScriptVersion.id == version_id).first()

    if not version:
        raise HTTPException(status_code=404, detail="Script version not found")

    return {
        "id": str(version.id),
        "client_id": version.client_id,
        "name": version.name,
        "version": version.version,
        "description": version.description,
        "schema_json": version.schema_json,
        "is_active": version.is_active,
        "created_at": version.created_at.isoformat(),
        "activated_at": version.activated_at.isoformat() if version.activated_at else None
    }


@router.post("/versions/upload")
async def upload_script_version(
    file: UploadFile = File(...),
    created_by_email: str = None,
    db: Session = Depends(get_db)
):
    """
    Upload a new script version from JSON file

    Validates JSON and creates new version record
    """
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="File must be a JSON file")

    try:
        # Read and parse JSON
        content = await file.read()
        schema_json = json.loads(content)

        # Validate required fields
        required_fields = ['version', 'client_id', 'name', 'nodes']
        missing = [f for f in required_fields if f not in schema_json]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required fields: {', '.join(missing)}"
            )

        # Get creator
        creator = None
        if created_by_email:
            creator = db.query(Agent).filter(Agent.email == created_by_email).first()

        # Create new version
        new_version = ScriptVersion(
            client_id=schema_json['client_id'],
            name=schema_json['name'],
            version=schema_json['version'],
            description=schema_json.get('description'),
            schema_json=schema_json,
            is_active=False,
            created_by=creator.id if creator else None
        )

        db.add(new_version)
        db.commit()
        db.refresh(new_version)

        logger.info(f"Uploaded new script version: {new_version.name} v{new_version.version}")

        return {
            "id": str(new_version.id),
            "message": "Script version uploaded successfully",
            "version": new_version.version
        }

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")
    except Exception as e:
        logger.error(f"Failed to upload script: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/versions/{version_id}/activate")
async def activate_script_version(version_id: str, db: Session = Depends(get_db)):
    """
    Activate a script version

    Deactivates all other versions for the same client
    """
    version = db.query(ScriptVersion).filter(ScriptVersion.id == version_id).first()

    if not version:
        raise HTTPException(status_code=404, detail="Script version not found")

    # Deactivate all other versions for this client
    db.query(ScriptVersion).filter(
        ScriptVersion.client_id == version.client_id,
        ScriptVersion.id != version.id
    ).update({"is_active": False})

    # Activate this version
    version.is_active = True
    version.activated_at = datetime.utcnow()

    db.commit()

    logger.info(f"Activated script version: {version.name} v{version.version}")

    return {
        "id": str(version.id),
        "message": "Script version activated",
        "version": version.version
    }


@router.delete("/versions/{version_id}")
async def delete_script_version(version_id: str, db: Session = Depends(get_db)):
    """
    Delete a script version

    Cannot delete active versions
    """
    version = db.query(ScriptVersion).filter(ScriptVersion.id == version_id).first()

    if not version:
        raise HTTPException(status_code=404, detail="Script version not found")

    if version.is_active:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete active script version. Deactivate it first."
        )

    db.delete(version)
    db.commit()

    logger.info(f"Deleted script version: {version.name} v{version.version}")

    return {"message": "Script version deleted"}


@router.get("/active")
async def get_active_script(client_id: str, db: Session = Depends(get_db)):
    """Get the currently active script for a client"""
    active_script = db.query(ScriptVersion).filter(
        ScriptVersion.client_id == client_id,
        ScriptVersion.is_active == True
    ).first()

    if not active_script:
        raise HTTPException(
            status_code=404,
            detail=f"No active script found for client {client_id}"
        )

    return {
        "id": str(active_script.id),
        "client_id": active_script.client_id,
        "name": active_script.name,
        "version": active_script.version,
        "description": active_script.description,
        "schema_json": active_script.schema_json,
        "activated_at": active_script.activated_at.isoformat() if active_script.activated_at else None
    }


@router.get("/download/{version_id}")
async def download_script_version(version_id: str, db: Session = Depends(get_db)):
    """Download script version as JSON file"""
    version = db.query(ScriptVersion).filter(ScriptVersion.id == version_id).first()

    if not version:
        raise HTTPException(status_code=404, detail="Script version not found")

    # Return JSON content
    from fastapi.responses import JSONResponse

    filename = f"{version.client_id}_{version.name.replace(' ', '_')}_v{version.version}.json"

    return JSONResponse(
        content=version.schema_json,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
