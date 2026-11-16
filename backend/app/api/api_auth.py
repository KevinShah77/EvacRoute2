from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.database import get_db, hash_password, verify_password
from app.models.models import User, AuditLog
from app.authentication.auth_handler import (
    create_access_token,
    get_current_user,
    require_roles
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "student"
    department: Optional[str] = None
    phone: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    department: Optional[str] = None
    phone: Optional[str] = None

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

@router.post("/register", response_model=LoginResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    if req.role not in ["student", "staff", "responder", "security", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role specified")

    new_user = User(
        email=req.email.lower(),
        password_hash=hash_password(req.password),
        full_name=req.full_name,
        role=req.role,
        department=req.department,
        phone=req.phone
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({"sub": str(new_user.id), "role": new_user.role, "email": new_user.email})
    return LoginResponse(
        access_token=token,
        user=UserResponse(
            id=new_user.id,
            email=new_user.email,
            full_name=new_user.full_name,
            role=new_user.role,
            department=new_user.department,
            phone=new_user.phone
        )
    )

@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower()).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id), "role": user.role, "email": user.email})
    return LoginResponse(
        access_token=token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            department=user.department,
            phone=user.phone
        )
    )

@router.post("/quick-demo-login", response_model=LoginResponse)
def quick_demo_login(role: str = "student", db: Session = Depends(get_db)):
    """One-click login helper for seamless testing and demonstration."""
    email_map = {
        "admin": "admin@evacroute.edu",
        "staff": "staff@evacroute.edu",
        "responder": "security@evacroute.edu",
        "security": "security@evacroute.edu",
        "student": "student@evacroute.edu"
    }
    target_email = email_map.get(role, "student@evacroute.edu")
    user = db.query(User).filter(User.email == target_email).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"Default {role} account not found")

    token = create_access_token({"sub": str(user.id), "role": user.role, "email": user.email})
    return LoginResponse(
        access_token=token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            department=user.department,
            phone=user.phone
        )
    )

@router.get("/me", response_model=UserResponse)
def get_current_profile(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        department=current_user.department,
        phone=current_user.phone
    )

class RoleUpdateRequest(BaseModel):
    role: str

@router.get("/stats")
def get_user_stats(db: Session = Depends(get_db)):
    students_count = db.query(User).filter(User.role == "student").count()
    staff_count = db.query(User).filter(User.role == "staff").count()
    admin_count = db.query(User).filter(User.role == "admin").count()
    return {
        "total_users": students_count + staff_count + admin_count,
        "total_students": students_count,
        "total_staff": staff_count,
        "total_admins": admin_count
    }

@router.get("/users", dependencies=[Depends(require_roles(["admin"]))])
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "department": u.department,
            "phone": u.phone,
            "created_at": u.created_at.isoformat() if u.created_at else None
        }
        for u in users
    ]

@router.put("/users/{user_id}/role", dependencies=[Depends(require_roles(["admin"]))])
def update_user_role(
    user_id: int,
    req: RoleUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if req.role not in ["student", "staff", "responder", "security", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role specified")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    old_role = user.role
    user.role = req.role
    audit = AuditLog(
        action="USER_ROLE_UPDATED",
        user_email=current_user.email,
        details=f"Changed user #{user_id} ({user.email}) role from {old_role} to {req.role}."
    )
    db.add(audit)
    db.commit()
    return {"success": True, "message": f"User role updated to '{req.role}'.", "user_id": user_id, "role": req.role}

@router.delete("/users/{user_id}", dependencies=[Depends(require_roles(["admin"]))])
def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own administrator account.")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    email = user.email
    db.delete(user)
    audit = AuditLog(
        action="USER_DELETED",
        user_email=current_user.email,
        details=f"Deleted user account #{user_id} ({email})."
    )
    db.add(audit)
    db.commit()
    return {"success": True, "message": f"User '{email}' successfully deleted."}
