"""ResumeContent schema tests: AI output must validate against the schema."""

from __future__ import annotations

import pytest
from app.ai.schemas import ContactInfo, ResumeContent, WorkEntry
from pydantic import ValidationError


def test_full_resume_content_validates() -> None:
    content = ResumeContent.model_validate(
        {
            "contact": {
                "full_name": "Ada Lovelace",
                "email": "ada@example.com",
                "phone": "+44 20 0000 0000",
                "location": "London",
                "links": ["https://example.com"],
            },
            "summary": "Mathematician.",
            "skills": ["Python", "SQL"],
            "experience": [
                {
                    "organization": "Analytical Engine",
                    "title": "Author",
                    "start_date": "1842",
                    "end_date": "1843",
                    "bullets": ["Wrote the first algorithm."],
                }
            ],
            "education": [{"institution": "University", "degree": "BSc"}],
            "projects": [{"name": "Note G", "bullets": ["Began the project."]}],
            "certifications": ["First Programmer"],
            "languages": ["English"],
        }
    )

    assert content.contact.full_name == "Ada Lovelace"
    assert content.experience[0].organization == "Analytical Engine"
    assert content.projects[0].name == "Note G"
    assert content.languages == ["English"]


def test_missing_fields_default_to_empty() -> None:
    content = ResumeContent.model_validate({"contact": {}})

    assert content.contact == ContactInfo()
    assert content.summary is None
    assert content.skills == []
    assert content.experience == []
    assert content.education == []
    assert content.projects == []
    assert content.certifications == []
    assert content.languages == []


def test_untrusted_extra_keys_are_ignored() -> None:
    content = ResumeContent.model_validate({"contact": {}, "fabricated": "garbage"})

    assert "fabricated" not in content.model_dump()
    assert content.contact == ContactInfo()


def test_wrong_types_are_rejected() -> None:
    with pytest.raises(ValidationError):
        ResumeContent.model_validate({"skills": "not-a-list"})


def test_model_dump_json_round_trips() -> None:
    content = sample_content()
    as_json = content.model_dump(mode="json")

    assert ResumeContent.model_validate(as_json) == content


def sample_content() -> ResumeContent:
    return ResumeContent(
        contact=ContactInfo(full_name="Grace Hopper", email="grace@example.com"),
        experience=[WorkEntry(organization="US Navy", bullets=["Built compilers."])],
    )
