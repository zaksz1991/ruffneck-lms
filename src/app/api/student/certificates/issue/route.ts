const {
  data: certificate,
  error: certificateError,
} = await supabase
  .from("course_certificates")
  .insert({
    student_id: user.id,
    course_id: courseId,
    holder_name: holderName,
    course_title: course.title,
    course_slug: course.slug,
    assessment_score:
      Math.round(
        assessmentPercentage
      ),
    capstone_score:
      approved.score,
    is_revoked: false,
  })
  .select(
    "id, certificate_number"
  )
  .single();

if (certificateError) {
  /*
   * PostgreSQL unique-constraint violation.
   *
   * Another request may have issued the certificate
   * between our existence check and this INSERT.
   * Return that certificate rather than treating the
   * concurrent request as a failure.
   */
  if (
    certificateError.code === "23505"
  ) {
    const {
      data: existingCertificate,
      error: existingCertificateError,
    } = await supabase
      .from("course_certificates")
      .select(
        "id, certificate_number"
      )
      .eq(
        "student_id",
        user.id
      )
      .eq(
        "course_id",
        courseId
      )
      .maybeSingle();

    if (
      !existingCertificateError &&
      existingCertificate
    ) {
      return NextResponse.json({
        certificateId:
          existingCertificate.id,
        certificateNumber:
          existingCertificate.certificate_number,
        alreadyIssued: true,
      });
    }

    console.error(
      "Certificate unique-constraint lookup failed:",
      existingCertificateError
    );
  }

  console.error(
    "Certificate issuance failed:",
    certificateError
  );

  return NextResponse.json(
    {
      error:
        "Unable to issue certificate.",
    },
    { status: 500 }
  );
}

if (!certificate) {
  return NextResponse.json(
    {
      error:
        "Unable to issue certificate.",
    },
    { status: 500 }
  );
}

return NextResponse.json({
  certificateId:
    certificate.id,
  certificateNumber:
    certificate.certificate_number,
  alreadyIssued: false,
});