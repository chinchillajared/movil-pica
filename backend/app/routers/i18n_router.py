from fastapi import APIRouter, HTTPException, status

from .. import i18n

router = APIRouter(prefix="/api/i18n", tags=["i18n"])


@router.get("/{lang}")
def get_translation(lang: str):
    data = i18n.load_translation(lang)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Language '{lang}' is not supported",
        )
    return data


@router.get("")
def list_languages():
    return {"supported": i18n.supported_languages()}
