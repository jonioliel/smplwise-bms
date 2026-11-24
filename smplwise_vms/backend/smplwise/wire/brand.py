"""Response models of routers/brand.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset({'GET /brand/company-logo/{variant}/{filename}'})
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'GET /brand/company-logo/{variant}'})


class BrandBrandPublicCompanyLogo(ExactModel):
    light: str | None
    dark: str | None


class BrandBrandPublicCompany(ExactModel):
    name: str
    logo: BrandBrandPublicCompanyLogo
    logo_file: BrandBrandPublicCompanyLogo


class BrandBrandPublicInstaller(ExactModel):
    enabled: bool
    accent: Any = None
    contact: Any = None
    logo: Any = None
    logo_file: Any = None
    name: Any = None


class BrandBrandPublic(ExactModel):
    company: BrandBrandPublicCompany
    size: str
    dark_mode: str
    installer: BrandBrandPublicInstaller


class BrandBrandGetCompanyLogo(ExactModel):
    light: Any
    dark: Any


class BrandBrandGetCompany(ExactModel):
    name: str
    kind: str
    logo: BrandBrandGetCompanyLogo
    logo_file: BrandBrandGetCompanyLogo


class BrandBrandGetTitle(ExactModel):
    prefix: str
    mode: str


class BrandBrandGetProject(ExactModel):
    name: str


class BrandBrandGet(ExactModel):
    installer: BrandBrandPublicInstaller
    company: BrandBrandGetCompany
    size: str
    logo_side: str
    company_logo_size: str
    dark_mode: str
    title: BrandBrandGetTitle
    project: BrandBrandGetProject
    files: BrandBrandGetCompanyLogo


class BrandBrandPutCompany(ExactModel):
    name: str
    kind: str
    logo: BrandBrandPublicCompanyLogo
    logo_file: BrandBrandPublicCompanyLogo


class BrandBrandPutFilesLight(ExactModel):
    stamp: str
    mime: str
    width: Num
    height: Num
    bytes: Num
    uploaded_by: str
    uploaded_at: str


class BrandBrandPutFiles(ExactModel):
    light: BrandBrandPutFilesLight | None
    dark: BrandBrandPutFilesLight | None


class BrandBrandPut(ExactModel):
    installer: BrandBrandPublicInstaller
    company: BrandBrandPutCompany
    size: str
    logo_side: str
    company_logo_size: str
    dark_mode: str
    title: BrandBrandGetTitle
    project: BrandBrandGetProject
    files: BrandBrandPutFiles


class BrandLogoUploadWarning(ExactModel):
    code: str
    message: str


class BrandLogoUploadViewCompanyLogo(ExactModel):
    light: str
    dark: str | None


class BrandLogoUploadViewCompany(ExactModel):
    name: str
    kind: str
    logo: BrandLogoUploadViewCompanyLogo
    logo_file: BrandLogoUploadViewCompanyLogo


class BrandLogoUploadView(ExactModel):
    installer: BrandBrandPublicInstaller
    company: BrandLogoUploadViewCompany
    size: str
    logo_side: str
    company_logo_size: str
    dark_mode: str
    title: BrandBrandGetTitle
    project: BrandBrandGetProject


class BrandLogoUploadFiles(ExactModel):
    light: BrandBrandPutFilesLight
    dark: BrandBrandPutFilesLight | None


class BrandLogoUpload(ExactModel):
    stamp: str
    variant: str
    mime: str
    width: Num
    height: Num
    warnings: list[BrandLogoUploadWarning]
    view: BrandLogoUploadView
    files: BrandLogoUploadFiles
